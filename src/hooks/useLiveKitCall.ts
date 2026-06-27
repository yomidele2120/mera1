import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LIVEKIT_URL } from "@/lib/livekit";

export type CallStatus = "idle" | "connecting" | "connected" | "error";
export type CallType = "video" | "voice";

interface UseLiveKitCallOptions {
  participantName: string;
  participantIdentity: string;
}

interface CallState {
  status: CallStatus;
  token: string | null;
  roomName: string | null;
  livekitUrl: string;
  error: string | null;
}

export function useLiveKitCall({ participantName, participantIdentity }: UseLiveKitCallOptions) {
  const [state, setState] = useState<CallState>({
    status: "idle",
    token: null,
    roomName: null,
    livekitUrl: LIVEKIT_URL,
    error: null,
  });

  const joinRoom = useCallback(
    async (roomName: string) => {
      setState((p) => ({ ...p, status: "connecting", error: null }));
      try {
        const { data, error } = await supabase.functions.invoke("livekit-token", {
          body: { roomName, participantName, participantIdentity },
        });
        if (error) throw error;
        if (!data?.token) throw new Error("No token returned");
        setState((p) => ({ ...p, status: "connected", token: data.token, roomName }));
      } catch (err: any) {
        setState((p) => ({ ...p, status: "error", error: err?.message ?? "Unknown error" }));
      }
    },
    [participantName, participantIdentity]
  );

  const leaveRoom = useCallback(() => {
    setState((p) => ({ ...p, status: "idle", token: null, roomName: null, error: null }));
  }, []);

  return { ...state, joinRoom, leaveRoom };
}
