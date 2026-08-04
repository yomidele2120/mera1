import { useState, useEffect } from "react";
import { Phone, Video, PhoneOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ZegoCall } from "./ZegoCall";

interface CallButtonProps {
  roomID: string;
  myID: string;
  myName: string;
  calleeID: string;
  calleeName?: string;
  calleeAvatar?: string | null;
  callType: "video" | "voice";
  disabled?: boolean;
}

type CallState = "idle" | "calling" | "accepted" | "declined" | "noanswer";

export function CallButton({
  roomID,
  myID,
  myName,
  calleeID,
  calleeName,
  calleeAvatar,
  callType,
  disabled,
}: CallButtonProps) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [callID, setCallID] = useState<string | null>(null);

  useEffect(() => {
    if (!callID) return;

    const channel = supabase
      .channel("call-status-" + callID)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "calls",
          filter: `id=eq.${callID}`,
        },
        (payload) => {
          const status = (payload.new as { status: string }).status;
          console.log("[CallButton] status update:", status);
          if (status === "accepted") setCallState("accepted");
          else if (status === "declined") setCallState("declined");
          else if (status === "ended") setCallState("idle");
        },
      )
      .subscribe();

    const timeout = setTimeout(async () => {
      setCallState((current) => {
        if (current === "calling") {
          supabase
            .from("calls")
            .update({ status: "ended", ended_at: new Date().toISOString() })
            .eq("id", callID)
            .then(() => console.log("[CallButton] timeout ended"));
          setTimeout(() => setCallState("idle"), 3000);
          return "noanswer";
        }
        return current;
      });
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearTimeout(timeout);
    };
  }, [callID]);

  const startCall = async () => {
    if (disabled) return;
    try {
      if ("vibrate" in navigator) navigator.vibrate([12, 40, 18]);
    } catch {
      /* noop */
    }
    console.log("[CallButton] starting call to:", calleeID);
    const { data, error } = await supabase
      .from("calls")
      .insert({
        room_id: roomID,
        caller_id: myID,
        caller_name: myName,
        callee_id: calleeID,
        call_type: callType,
        status: "ringing",
      })
      .select()
      .single();

    if (error) {
      console.error("[CallButton] insert failed:", error);
      return;
    }
    console.log("[CallButton] call inserted:", data);
    setCallID(data.id);
    setCallState("calling");
  };

  const cancelCall = async (durationSeconds?: number) => {
    if (callID) {
      await supabase
        .from("calls")
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
          ...(typeof durationSeconds === "number" ? { duration_seconds: durationSeconds } : {}),
        })
        .eq("id", callID);
    }
    setCallState("idle");
    setCallID(null);
  };

  if (callState === "accepted" && callID) {
    return (
      <ZegoCall
        roomID={roomID}
        userID={myID}
        userName={myName}
        callType={callType}
        peerName={calleeName}
        peerAvatar={calleeAvatar}
        onLeave={(durationSeconds) => {
          cancelCall(durationSeconds);
        }}
      />
    );
  }

  if (callState === "calling") {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9998,
          background: "rgba(0,0,0,0.85)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "24px",
          color: "#fff",
        }}
      >
        <div style={{ fontSize: "64px" }}>
          {callType === "video" ? "📹" : "🎙️"}
        </div>
        <div style={{ fontSize: "22px", fontWeight: 600 }}>Calling...</div>
        <div style={{ opacity: 0.7 }}>Waiting for answer</div>
        <button
          onClick={() => cancelCall()}
          aria-label="Cancel call"
          style={{
            marginTop: "16px",
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "#ef4444",
            border: "none",
            fontSize: "24px",
            cursor: "pointer",
          }}
        >
          📵
        </button>
      </div>
    );
  }

  if (callState === "declined" || callState === "noanswer") {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9998,
          background: "rgba(0,0,0,0.85)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          color: "#fff",
        }}
      >
        <div style={{ fontSize: "22px", fontWeight: 600 }}>
          {callState === "declined" ? "Call Declined" : "No Answer"}
        </div>
        <button
          onClick={() => {
            setCallState("idle");
            setCallID(null);
          }}
          style={{
            padding: "10px 24px",
            borderRadius: "8px",
            background: "#333",
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startCall}
      disabled={disabled}
      title={callType === "video" ? "Video Call" : "Voice Call"}
      aria-label={callType === "video" ? "Start video call" : "Start voice call"}
      style={{
        background: "none",
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        padding: "6px",
        opacity: disabled ? 0.4 : 1,
        color: "inherit",
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      {callType === "video" ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
    </button>
  );
}

export { PhoneOff };
