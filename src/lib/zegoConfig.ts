import { supabase } from "@/integrations/supabase/client";

export async function getZegoToken(userID: string): Promise<{ appID: number; token: string }> {
  const { data, error } = await supabase.functions.invoke("zego-token", {
    body: { userID },
  });
  if (error || !data?.appID || !data?.token) {
    throw new Error(data?.error ?? error?.message ?? "Failed to load Zego token");
  }
  return { appID: Number(data.appID), token: String(data.token) };
}
