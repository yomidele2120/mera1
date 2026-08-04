import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface IncomingCall {
  id: string;
  room_id: string;
  caller_id: string;
  caller_name: string;
  call_type: "video" | "voice";
  caller_avatar?: string | null;
}

export function useCallSignaling(currentUserID: string) {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

  useEffect(() => {
    if (!currentUserID) return;

    console.log("[useCallSignaling] subscribing for user:", currentUserID);

    const channel = supabase
      .channel("incoming-calls-" + currentUserID)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "calls",
          filter: `callee_id=eq.${currentUserID}`,
        },
        (payload) => {
          console.log("[useCallSignaling] incoming call:", payload);
          const call = payload.new as {
            id: string;
            room_id: string;
            caller_id: string;
            caller_name: string;
            call_type: "video" | "voice";
            status: string;
          };
          if (call.status === "ringing") {
            setIncomingCall({
              id: call.id,
              room_id: call.room_id,
              caller_id: call.caller_id,
              caller_name: call.caller_name,
              call_type: call.call_type,
            });
            supabase
              .from("profiles")
              .select("avatar_url")
              .eq("id", call.caller_id)
              .maybeSingle()
              .then(({ data }) => {
                if (data?.avatar_url) {
                  setIncomingCall((prev) =>
                    prev && prev.id === call.id ? { ...prev, caller_avatar: data.avatar_url } : prev,
                  );
                }
              });
          }
        },
      )
      .subscribe((status) => {
        console.log("[useCallSignaling] subscription status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserID]);

  // Mirror the other side hanging up: if the call row is ended/declined elsewhere,
  // tear the call down locally too.
  useEffect(() => {
    if (!incomingCall) return;
    const channel = supabase
      .channel("call-state-" + incomingCall.id)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "calls",
          filter: `id=eq.${incomingCall.id}`,
        },
        (payload) => {
          const status = (payload.new as { status: string }).status;
          console.log("[useCallSignaling] call state:", status);
          if (status === "ended" || status === "declined" || status === "missed") {
            setIncomingCall(null);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [incomingCall?.id]);

  const acceptCall = async () => {
    if (!incomingCall) return;
    console.log("[useCallSignaling] accepting", incomingCall.id);
    await supabase
      .from("calls")
      .update({ status: "accepted", started_at: new Date().toISOString() })
      .eq("id", incomingCall.id);
  };

  const declineCall = async () => {
    if (!incomingCall) return;
    console.log("[useCallSignaling] declining", incomingCall.id);
    await supabase
      .from("calls")
      .update({ status: "declined", ended_at: new Date().toISOString() })
      .eq("id", incomingCall.id);
    setIncomingCall(null);
  };

  const endCall = async (durationSeconds?: number) => {
    if (!incomingCall) return;
    console.log("[useCallSignaling] ending", incomingCall.id, durationSeconds);
    await supabase
      .from("calls")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
        ...(typeof durationSeconds === "number" ? { duration_seconds: durationSeconds } : {}),
      })
      .eq("id", incomingCall.id);
    setIncomingCall(null);
  };

  return { incomingCall, setIncomingCall, acceptCall, declineCall, endCall };
}
