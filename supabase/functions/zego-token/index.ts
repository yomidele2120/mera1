// Generates a ZegoCloud token04 using the ServerSecret (server-side, secure).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function concat(...parts: Uint8Array[]) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function u16(n: number) {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, n, false);
  return b;
}

function i64(n: number) {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigInt64(0, BigInt(n), false);
  return b;
}

function base64(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

async function generateToken04(
  appId: number,
  userId: string,
  secret: string,
  effectiveTimeInSeconds: number,
  payload = "",
) {
  const ctime = Math.floor(Date.now() / 1000);
  const expire = ctime + effectiveTimeInSeconds;
  const nonce = Math.floor(Math.random() * 2147483647) - 1073741823;

  const plaintext = new TextEncoder().encode(
    JSON.stringify({
      app_id: appId,
      user_id: userId,
      nonce,
      ctime,
      expire,
      payload,
    }),
  );

  const iv = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "AES-CBC" },
    false,
    ["encrypt"],
  );
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-CBC", iv }, key, plaintext),
  );

  const buf = concat(i64(expire), u16(iv.length), iv, u16(cipher.length), cipher);
  return "04" + base64(buf);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const appIdRaw = (Deno.env.get("ZEGO_APP_ID") ?? "").trim();
  const secret = (Deno.env.get("ZEGO_SERVER_SECRET") ?? "").trim();

  if (!appIdRaw || !secret) {
    return json({ error: "Zego credentials not configured (ZEGO_APP_ID / ZEGO_SERVER_SECRET)" }, 500);
  }
  if (!/^\d+$/.test(appIdRaw)) {
    return json({ error: "ZEGO_APP_ID must be numeric" }, 400);
  }
  if (secret.length !== 32) {
    return json({
      error: `ZEGO_SERVER_SECRET must be exactly 32 characters, got ${secret.length}. Copy the ServerSecret (not the 64-char AppSign) from the ZEGOCLOUD console.`,
    }, 400);
  }

  let userID = "";
  try {
    const body = await req.json();
    userID = String(body?.userID ?? "").trim();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!userID) return json({ error: "userID is required" }, 400);

  try {
    const appID = Number(appIdRaw);
    const token = await generateToken04(appID, userID, secret, 3600);
    return json({ appID, token });
  } catch (e) {
    console.error("[zego-token] failed", e);
    return json({ error: "Failed to generate token" }, 500);
  }
});
