import { useCallback, useEffect, useRef, useState } from "react";
import { PhoneOff, Loader2, WifiOff } from "lucide-react";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import { getZegoToken, toZegoUserID } from "@/lib/zegoConfig";

interface ZegoCallProps {
  roomID: string;
  userID: string;
  userName: string;
  callType: "video" | "voice";
  /** Called when the call ends. Receives the connected duration in seconds. */
  onLeave: (durationSeconds: number) => void;
}

type Phase = "connecting" | "connected" | "reconnecting";

function formatDuration(total: number) {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function ZegoCall({ roomID, userID, userName, callType, onLeave }: ZegoCallProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [elapsed, setElapsed] = useState(0);

  const startedAtRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);
  const leftRef = useRef(false);

  const totalDuration = useCallback(() => {
    const live = startedAtRef.current ? (Date.now() - startedAtRef.current) / 1000 : 0;
    return Math.round(accumulatedRef.current + live);
  }, []);

  const handleLeave = useCallback(() => {
    if (leftRef.current) return;
    leftRef.current = true;
    onLeave(totalDuration());
  }, [onLeave, totalDuration]);

  // Live timer tick
  useEffect(() => {
    if (phase === "connecting") return;
    const id = setInterval(() => setElapsed(totalDuration()), 1000);
    return () => clearInterval(id);
  }, [phase, totalDuration]);

  // Network dropout handling
  useEffect(() => {
    const goOffline = () => {
      setPhase((p) => {
        if (p === "connecting") return p;
        if (startedAtRef.current) {
          accumulatedRef.current += (Date.now() - startedAtRef.current) / 1000;
          startedAtRef.current = null;
        }
        return "reconnecting";
      });
    };
    const goOnline = () => {
      setPhase((p) => {
        if (p !== "reconnecting") return p;
        startedAtRef.current = Date.now();
        return "connected";
      });
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let zp: ReturnType<typeof ZegoUIKitPrebuilt.create> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const attempt = async (tryNo: number) => {
      if (cancelled || !containerRef.current) return;
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
        console.log("[ZegoCall] joining room", { roomID, callType, tryNo });
        zp = ZegoUIKitPrebuilt.create(kitToken);
        zp.joinRoom({
          container: containerRef.current,
          scenario: { mode: ZegoUIKitPrebuilt.OneONoneCall },
          turnOnCameraWhenJoining: callType === "video",
          turnOnMicrophoneWhenJoining: true,
          showPreJoinView: false,
          onJoinRoom: () => {
            if (cancelled) return;
            startedAtRef.current = Date.now();
            setPhase("connected");
          },
          onLeaveRoom: handleLeave,
        });
      } catch (err) {
        console.error("[ZegoCall] failed to join", err);
        if (cancelled) return;
        if (tryNo < 3) {
          setPhase((p) => (p === "connecting" ? "connecting" : "reconnecting"));
          retryTimer = setTimeout(() => attempt(tryNo + 1), 1500 * tryNo);
        } else {
          handleLeave();
        }
      }
    };

    attempt(1);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      try {
        zp?.destroy();
      } catch (e) {
        console.warn("[ZegoCall] destroy failed", e);
      }
    };
  }, [roomID, userID, userName, callType, handleLeave]);

  return (
    <>
      <div
        ref={containerRef}
        style={{
          width: "100vw",
          height: "100dvh",
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 9999,
          background: "#111",
        }}
      />

      {/* Connecting overlay */}
      {phase === "connecting" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10001,
            background: "radial-gradient(circle at 50% 35%, #2a1206 0%, #0c0906 70%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
            color: "#fff",
          }}
        >
          <div
            style={{
              width: 108,
              height: 108,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, hsl(24 95% 55%), hsl(38 95% 58%))",
              boxShadow: "0 0 0 0 rgba(249,115,22,0.55)",
              animation: "zego-pulse 1.8s ease-out infinite",
              fontSize: 44,
            }}
          >
            {callType === "video" ? "📹" : "🎙️"}
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: 0.2 }}>Connecting…</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.7, fontSize: 14 }}>
            <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
            Setting up a secure {callType === "video" ? "video" : "voice"} connection
          </div>
          <style>{`
            @keyframes zego-pulse {
              0% { box-shadow: 0 0 0 0 rgba(249,115,22,0.55); }
              70% { box-shadow: 0 0 0 28px rgba(249,115,22,0); }
              100% { box-shadow: 0 0 0 0 rgba(249,115,22,0); }
            }
            @keyframes spin { to { transform: rotate(360deg); } }
          `}</style>
        </div>
      )}

      {/* Duration timer */}
      {phase !== "connecting" && (
        <div
          style={{
            position: "fixed",
            top: "calc(12px + env(safe-area-inset-top, 0px))",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10000,
            padding: "6px 14px",
            borderRadius: 999,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(10px)",
            color: "#fff",
            fontSize: 14,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 600,
          }}
        >
          {formatDuration(elapsed)}
        </div>
      )}

      {/* Reconnecting banner */}
      {phase === "reconnecting" && (
        <div
          style={{
            position: "fixed",
            top: "calc(52px + env(safe-area-inset-top, 0px))",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 999,
            background: "rgba(239,68,68,0.92)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
          }}
        >
          <WifiOff size={15} />
          Reconnecting…
        </div>
      )}

      <button
        onClick={() => {
          try {
            if ("vibrate" in navigator) navigator.vibrate(30);
          } catch {
            /* noop */
          }
          handleLeave();
        }}
        aria-label="End call"
        title="End call"
        style={{
          position: "fixed",
          left: "50%",
          transform: "translateX(-50%)",
          bottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
          zIndex: 10002,
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
