import { supabase } from "@/integrations/supabase/client";

let cache: Promise<{ appID: number; appSign: string }> | null = null;

export function getZegoConfig() {
  if (!cache) {
    cache = supabase.functions.invoke("zego-config").then(({ data, error }) => {
      if (error || !data?.appID || !data?.appSign) {
        cache = null;
        throw error ?? new Error("Failed to load Zego config");
      }
      return { appID: Number(data.appID), appSign: String(data.appSign) };
    });
  }
  return cache;
}
