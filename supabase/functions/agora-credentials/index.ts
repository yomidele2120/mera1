import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AGORA_APP_ID = Deno.env.get("AGORA_APP_ID");
    
    if (!AGORA_APP_ID) {
      console.error("AGORA_APP_ID is not configured");
      throw new Error("Agora is not configured");
    }

    // For now, we return just the App ID
    // In production, you would generate a token here using the Agora token builder
    return new Response(
      JSON.stringify({ 
        appId: AGORA_APP_ID,
        // token: null means we're using App ID authentication (testing mode)
        // For production, implement token generation here
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
