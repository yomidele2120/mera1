import { useEffect, useRef } from "react";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import { getZegoToken } from "@/lib/zegoConfig";

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
        const { appID, token } = await getZegoToken(userID);
        if (cancelled || !containerRef.current) return;

        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForProduction(
          appID,
          token,
          roomID,
          userID,
          userName,
        );
        console.log("[ZegoCall] joining room", { roomID, userID, callType });
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
  );
}
