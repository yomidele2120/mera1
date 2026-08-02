import { supabase } from "@/integrations/supabase/client";

// Zego user IDs are limited to 32 bytes. Database user IDs are UUIDs (36 chars),
// so remove UUID separators while preserving a stable one-to-one identifier.
export function toZegoUserID(userID: string): string {
  const normalized = userID.trim().replace(/-/g, "").replace(/[^a-zA-Z0-9_]/g, "_");
  if (!normalized) throw new Error("A valid user ID is required to join the call");
  return normalized.slice(0, 32);
}

export async function getZegoToken(userID: string): Promise<{ appID: number; token: string }> {
  const zegoUserID = toZegoUserID(userID);
  const { data, error } = await supabase.functions.invoke("zego-token", {
    body: { userID: zegoUserID },
  });
  if (error || !data?.appID || !data?.token) {
    throw new Error(data?.error ?? error?.message ?? "Failed to load Zego token");
  }
  return { appID: Number(data.appID), token: String(data.token) };
}
