import { useState } from "react";
import type { IncomingCall } from "@/hooks/useCallSignaling";
import { ZegoCall } from "./ZegoCall";

interface IncomingCallOverlayProps {
  incomingCall: IncomingCall;
  currentUserID: string;
  currentUserName: string;
  onAccept: () => void;
  onDecline: () => void;
  onEnd?: () => void;
}

export function IncomingCallOverlay({
  incomingCall,
  currentUserID,
  currentUserName,
  onAccept,
  onDecline,
  onEnd,
}: IncomingCallOverlayProps) {
  const [accepted, setAccepted] = useState(false);

  if (accepted) {
    return (
      <ZegoCall
        roomID={incomingCall.room_id}
        userID={currentUserID}
        userName={currentUserName}
        callType={incomingCall.call_type}
        onLeave={() => {
          setAccepted(false);
          onEnd?.();
        }}
      />
    );
  }

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
        {incomingCall.call_type === "video" ? "📹" : "🎙️"}
      </div>
      <div style={{ fontSize: "24px", fontWeight: 600 }}>
        {incomingCall.caller_name}
      </div>
      <div style={{ fontSize: "16px", opacity: 0.7 }}>
        Incoming {incomingCall.call_type} call...
      </div>
      <div style={{ display: "flex", gap: "32px", marginTop: "16px" }}>
        <button
          onClick={onDecline}
          aria-label="Decline call"
          style={{
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
        <button
          onClick={() => {
            onAccept();
            setAccepted(true);
          }}
          aria-label="Accept call"
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "#22c55e",
            border: "none",
            fontSize: "24px",
            cursor: "pointer",
          }}
        >
          📞
        </button>
      </div>
    </div>
  );
}
