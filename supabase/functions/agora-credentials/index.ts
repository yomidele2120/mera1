import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Agora RTC Token Privileges
const Privileges = {
  kJoinChannel: 1,
  kPublishAudioStream: 2,
  kPublishVideoStream: 3,
  kPublishDataStream: 4,
};

// Token version
const VERSION = "007";
const VERSION_LENGTH = 3;

// CRC32 lookup table
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function encodeUint16(value: number): Uint8Array {
  const buffer = new Uint8Array(2);
  buffer[0] = value & 0xFF;
  buffer[1] = (value >> 8) & 0xFF;
  return buffer;
}

function encodeUint32(value: number): Uint8Array {
  const buffer = new Uint8Array(4);
  buffer[0] = value & 0xFF;
  buffer[1] = (value >> 8) & 0xFF;
  buffer[2] = (value >> 16) & 0xFF;
  buffer[3] = (value >> 24) & 0xFF;
  return buffer;
}

function encodeString(str: string): Uint8Array {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(str);
  const length = encodeUint16(encoded.length);
  const result = new Uint8Array(length.length + encoded.length);
  result.set(length);
  result.set(encoded, length.length);
  return result;
}

function encodeBytes(bytes: Uint8Array): Uint8Array {
  const length = encodeUint16(bytes.length);
  const result = new Uint8Array(length.length + bytes.length);
  result.set(length);
  result.set(bytes, length.length);
  return result;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function base64Encode(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key.buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, data.buffer as ArrayBuffer);
  return new Uint8Array(signature);
}

function packPrivileges(privileges: Map<number, number>): Uint8Array {
  const parts: Uint8Array[] = [];
  parts.push(encodeUint16(privileges.size));
  
  for (const [key, value] of privileges) {
    parts.push(encodeUint16(key));
    parts.push(encodeUint32(value));
  }
  
  return concatBytes(...parts);
}

async function generateRtcToken(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: number,
  privilegeExpiredTs: number
): Promise<string> {
  console.log("Generating RTC token for channel:", channelName, "uid:", uid);
  
  const timestamp = Math.floor(Date.now() / 1000);
  const salt = Math.floor(Math.random() * 0xFFFFFFFF);
  
  // Build privileges map
  const privileges = new Map<number, number>();
  privileges.set(Privileges.kJoinChannel, privilegeExpiredTs);
  privileges.set(Privileges.kPublishAudioStream, privilegeExpiredTs);
  privileges.set(Privileges.kPublishVideoStream, privilegeExpiredTs);
  privileges.set(Privileges.kPublishDataStream, privilegeExpiredTs);
  
  // Pack message
  const messageParts = concatBytes(
    encodeUint32(salt),
    encodeUint32(timestamp),
    packPrivileges(privileges)
  );
  
  // Generate signature
  const encoder = new TextEncoder();
  const signContent = concatBytes(
    encoder.encode(appId),
    encoder.encode(channelName),
    encoder.encode(String(uid)),
    messageParts
  );
  
  const signature = await hmacSha256(encoder.encode(appCertificate), signContent);
  
  // Pack token content
  const tokenContent = concatBytes(
    encodeBytes(signature),
    encodeBytes(encoder.encode(appId)),
    encodeUint32(timestamp),
    encodeUint32(salt),
    encodeUint16(privilegeExpiredTs > 0 ? Math.floor((privilegeExpiredTs - timestamp) / 60) : 0),
    encodeUint16(privileges.size)
  );
  
  // Add privileges
  const privilegeParts: Uint8Array[] = [];
  for (const [key, value] of privileges) {
    privilegeParts.push(encodeUint16(key));
    privilegeParts.push(encodeUint32(value));
  }
  
  const finalContent = concatBytes(
    tokenContent,
    ...privilegeParts
  );
  
  // Calculate CRC
  const crcValue = crc32(finalContent);
  
  // Build final token
  const finalToken = concatBytes(
    encodeUint32(crcValue),
    finalContent
  );
  
  const token = VERSION + base64Encode(finalToken);
  console.log("Token generated successfully, length:", token.length);
  
  return token;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AGORA_APP_ID = Deno.env.get("NEXT_PUBLIC_AGORA_APP_ID");
    const AGORA_APP_CERTIFICATE = Deno.env.get("AGORA_APP_CERTIFICATE");
    
    if (!AGORA_APP_ID) {
      console.error("AGORA_APP_ID is not configured");
      throw new Error("Agora is not configured");
    }

    // Get request body
    const { channelName, uid } = await req.json().catch(() => ({ channelName: null, uid: null }));
    
    console.log("Request - channelName:", channelName, "uid:", uid);
    console.log("Has App Certificate:", !!AGORA_APP_CERTIFICATE);
    
    // If no App Certificate, return just the App ID (testing mode)
    if (!AGORA_APP_CERTIFICATE) {
      console.log("No App Certificate configured, returning App ID only (testing mode)");
      return new Response(
        JSON.stringify({ 
          appId: AGORA_APP_ID,
          token: null,
          mode: "testing"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Validate required parameters for token generation
    if (!channelName) {
      console.error("Channel name is required for token generation");
      throw new Error("Channel name is required");
    }
    
    // Use provided UID or generate a random one
    const userUid = uid || Math.floor(Math.random() * 100000);
    
    // Token expires in 24 hours
    const privilegeExpiredTs = Math.floor(Date.now() / 1000) + 86400;
    
    // Generate RTC token
    const token = await generateRtcToken(
      AGORA_APP_ID,
      AGORA_APP_CERTIFICATE,
      channelName,
      userUid,
      privilegeExpiredTs
    );
    
    console.log("Returning token for production mode");
    
    return new Response(
      JSON.stringify({ 
        appId: AGORA_APP_ID,
        token,
        uid: userUid,
        mode: "production"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Agora credentials error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to get Agora credentials" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
