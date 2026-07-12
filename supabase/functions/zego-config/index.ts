// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const appID = Deno.env.get("ZEGO_APP_ID")?.trim();
  const appSign = Deno.env.get("ZEGO_APP_SIGN")?.trim();

  if (!appID || !appSign) {
    return new Response(
      JSON.stringify({ error: "Zego credentials not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!/^\d+$/.test(appID)) {
    return new Response(
      JSON.stringify({ error: "ZEGO_APP_ID must be numeric" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!/^[a-f0-9]{64}$/i.test(appSign)) {
    return new Response(
      JSON.stringify({
        error:
          "ZEGO_APP_SIGN must be the 64-character hex AppSign from the ZEGOCLOUD console (not the 32-char ServerSecret).",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ appID: Number(appID), appSign }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
