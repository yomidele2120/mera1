// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const rawAppID = Deno.env.get("ZEGO_APP_ID") ?? "";
  const rawAppSign = Deno.env.get("ZEGO_APP_SIGN") ?? "";
  const appID = rawAppID.trim();
  const appSign = rawAppSign.trim();

  if (!appID || !appSign) {
    return new Response(
      JSON.stringify({ error: "Zego credentials not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (/\s/.test(rawAppID) || /\s/.test(rawAppSign)) {
    return new Response(
      JSON.stringify({
        error: "ZEGO_APP_ID and ZEGO_APP_SIGN must not contain whitespace (leading, trailing, or embedded).",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!/^\d+$/.test(appID)) {
    return new Response(
      JSON.stringify({ error: "ZEGO_APP_ID must be numeric" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (appSign.length !== 64) {
    return new Response(
      JSON.stringify({
        error: `ZEGO_APP_SIGN must be exactly 64 hex characters, got ${appSign.length}. Use the AppSign from the ZEGOCLOUD console, not the 32-character ServerSecret.`,
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!/^[a-f0-9]{64}$/i.test(appSign)) {
    return new Response(
      JSON.stringify({
        error: "ZEGO_APP_SIGN must be a 64-character hexadecimal string (0-9, a-f).",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ appID: Number(appID), appSign }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
