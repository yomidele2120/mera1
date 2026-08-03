import { useEffect, useRef } from "react";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import { getZegoToken, toZegoUserID } from "@/lib/zegoConfig";

interface ZegoCallProps {
  roomID: string;
  userID: string;
  userName: string;
  callType: "video" | "voice";
  onLeave: () => void;
}

export function ZegoCall({ roomID, userID, userName, callType, onLeave }: ZegoCallProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let zp: ReturnType<typeof ZegoUIKitPrebuilt.create> | null = null;

    (async () => {
      if (!containerRef.current) return;
      try {
        const zegoUserID = toZegoUserID(userID);
        const { appID, token } = await getZegoToken(zegoUserID);
        if (cancelled || !containerRef.current) return;

        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForProduction(
          appID,
          token,
          roomID,
          zegoUserID,
          userName,
        );
        console.log("[ZegoCall] joining room", { roomID, callType });
        zp = ZegoUIKitPrebuilt.create(kitToken);
        zp.joinRoom({
          container: containerRef.current,
          scenario: { mode: ZegoUIKitPrebuilt.OneONoneCall },
          turnOnCameraWhenJoining: callType === "video",
          turnOnMicrophoneWhenJoining: true,
          showPreJoinView: false,
          onLeaveRoom: onLeave,
        });
      } catch (err) {
        console.error("[ZegoCall] failed to join", err);
        onLeave();
      }
    })();

    return () => {
      cancelled = true;
      try {
        zp?.destroy();
      } catch (e) {
        console.warn("[ZegoCall] destroy failed", e);
      }
    };
  }, [roomID, userID, userName, callType, onLeave]);

  return (
    <>
      <div
        ref={containerRef}
        style={{
          width: "100vw",
          height: "100vh",
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 9999,
          background: "#111",
        }}
      />
      <button
        onClick={() => {
          try {
            if ("vibrate" in navigator) navigator.vibrate(30);
          } catch {
            /* noop */
          }
          onLeave();
        }}
        aria-label="End call"
        title="End call"
        style={{
          position: "fixed",
          left: "50%",
          transform: "translateX(-50%)",
          bottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
          zIndex: 10000,
          width: 68,
          height: 68,
          borderRadius: "50%",
          background: "#ef4444",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
        }}
      >
        <PhoneOff size={28} />
      </button>
    </>
  );
}
