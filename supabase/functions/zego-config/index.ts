// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const appID = Deno.env.get("ZEGO_APP_ID");
  const appSign = Deno.env.get("ZEGO_APP_SIGN");

  if (!appID || !appSign) {
    return new Response(
      JSON.stringify({ error: "Zego credentials not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // NOTE: appSign returned to the client is only acceptable for
  // generateKitTokenForTest during development. Replace with a
  // server-issued token before going to production.
  return new Response(
    JSON.stringify({ appID: Number(appID), appSign }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
