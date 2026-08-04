import { useCallback, useEffect, useRef, useState } from "react";
import {
  PhoneOff,
  Loader2,
  WifiOff,
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Volume2,
  Ear,
  MoreHorizontal,
  Share2,
  RefreshCw,
  Minimize2,
  X,
  SwitchCamera,
} from "lucide-react";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import { getZegoToken, toZegoUserID } from "@/lib/zegoConfig";
import { Avatar } from "@/components/common/Avatar";

interface ZegoCallProps {
  roomID: string;
  userID: string;
  userName: string;
  callType: "video" | "voice";
  /** Name of the other participant, shown in the call header. */
  peerName?: string;
  /** Avatar of the other participant. */
  peerAvatar?: string | null;
  /** Called when the call ends. Receives the connected duration in seconds. */
  onLeave: (durationSeconds: number) => void;
}

type Phase = "connecting" | "connected" | "reconnecting" | "failed";

const MAX_ATTEMPTS = 3;

function formatDuration(total: number) {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function ZegoCall({
  roomID,
  userID,
  userName,
  callType,
  peerName,
  peerAvatar,
  onLeave,
}: ZegoCallProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [attempt, setAttempt] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const [sessionKey, setSessionKey] = useState(0);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(callType === "video");
  const [speakerOn, setSpeakerOn] = useState(true);
  const [showMore, setShowMore] = useState(false);
  const [minimizedInfo, setMinimizedInfo] = useState(false);

  const zpRef = useRef<ReturnType<typeof ZegoUIKitPrebuilt.create> | null>(null);
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
    try {
      zpRef.current?.destroy();
    } catch {
      /* noop */
    }
    onLeave(totalDuration());
  }, [onLeave, totalDuration]);

  // Live timer tick
  useEffect(() => {
    if (phase === "connecting" || phase === "failed") return;
    const id = setInterval(() => setElapsed(totalDuration()), 1000);
    return () => clearInterval(id);
  }, [phase, totalDuration]);

  // Network dropout handling
  useEffect(() => {
    const goOffline = () => {
      setPhase((p) => {
        if (p === "connecting" || p === "failed") return p;
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
        setAttempt(1);
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

  // Make sure remote audio really plays (autoplay/muted-element guards)
  useEffect(() => {
    if (phase !== "connected") return;
    const unmute = () => {
      const root = containerRef.current;
      if (!root) return;
      root.querySelectorAll<HTMLMediaElement>("audio, video").forEach((el) => {
        if (el.dataset.selfView === "true") return;
        el.muted = false;
        el.volume = 1;
        const p = el.play();
        if (p && typeof p.catch === "function") p.catch(() => undefined);
      });
    };
    unmute();
    const id = setInterval(unmute, 2000);
    return () => clearInterval(id);
  }, [phase]);

  // Join the room (re-runs when the user retries)
  useEffect(() => {
    let cancelled = false;
    let zp: ReturnType<typeof ZegoUIKitPrebuilt.create> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const attemptJoin = async (tryNo: number) => {
      if (cancelled || !containerRef.current) return;
      setAttempt(tryNo);
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
        zpRef.current = zp;
        zp.joinRoom({
          container: containerRef.current,
          scenario: { mode: ZegoUIKitPrebuilt.OneONoneCall },
          turnOnCameraWhenJoining: callType === "video",
          turnOnMicrophoneWhenJoining: true,
          useFrontFacingCamera: true,
          showPreJoinView: false,
          showLeavingView: false,
          showLeaveRoomConfirmDialog: false,
          showMyCameraToggleButton: false,
          showMyMicrophoneToggleButton: false,
          showAudioVideoSettingsButton: false,
          showScreenSharingButton: false,
          showTextChat: false,
          showUserList: false,
          showRoomTimer: false,
          showRoomDetailsButton: false,
          showLayoutButton: false,
          showPinButton: false,
          showMoreButton: false,
          onJoinRoom: () => {
            if (cancelled) return;
            startedAtRef.current = Date.now();
            setAttempt(1);
            setMicOn(true);
            setCamOn(callType === "video");
            setPhase("connected");
          },
          onLeaveRoom: handleLeave,
        });
      } catch (err) {
        console.error("[ZegoCall] failed to join", err);
        if (cancelled) return;
        if (tryNo < MAX_ATTEMPTS) {
          setPhase((p) => (p === "connected" ? "reconnecting" : "connecting"));
          retryTimer = setTimeout(() => attemptJoin(tryNo + 1), 1500 * tryNo);
        } else {
          setPhase("failed");
        }
      }
    };

    attemptJoin(1);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      try {
        zp?.destroy();
      } catch (e) {
        console.warn("[ZegoCall] destroy failed", e);
      }
    };
  }, [roomID, userID, userName, callType, handleLeave, sessionKey]);

  const localStream = () =>
    (zpRef.current as unknown as { localStream?: MediaStream } | null)?.localStream ?? null;

  const toggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    localStream()
      ?.getAudioTracks()
      .forEach((t) => (t.enabled = next));
    try {
      (zpRef.current as unknown as { express?: { muteMicrophone?: (m: boolean) => void } })
        ?.express?.muteMicrophone?.(!next);
    } catch {
      /* noop */
    }
  };

  const toggleCam = () => {
    const stream = localStream();
    const tracks = stream?.getVideoTracks() ?? [];
    if (!tracks.length) return;
    const next = !camOn;
    setCamOn(next);
    tracks.forEach((t) => (t.enabled = next));
  };

  const toggleSpeaker = async () => {
    const next = !speakerOn;
    setSpeakerOn(next);
    const root = containerRef.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLMediaElement>("audio, video"));
    for (const el of els) {
      el.muted = false;
      el.volume = next ? 1 : 0.45;
      const withSink = el as HTMLMediaElement & {
        setSinkId?: (id: string) => Promise<void>;
      };
      if (typeof withSink.setSinkId === "function") {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const outputs = devices.filter((d) => d.kind === "audiooutput");
          const speaker =
            outputs.find((d) => /speaker/i.test(d.label)) ?? outputs.find((d) => d.deviceId === "default");
          const earpiece = outputs.find((d) => /earpiece|receiver|handset/i.test(d.label));
          const target = next ? speaker : (earpiece ?? speaker);
          if (target) await withSink.setSinkId(target.deviceId);
        } catch {
          /* device switching unsupported */
        }
      }
    }
  };

  const switchCamera = async () => {
    try {
      const stream = localStream();
      const track = stream?.getVideoTracks()[0];
      const current = track?.getSettings().facingMode;
      await track?.applyConstraints({
        facingMode: current === "user" ? "environment" : "user",
      });
    } catch {
      /* noop */
    }
    setShowMore(false);
  };

  const shareCall = async () => {
    const url = `${window.location.origin}${window.location.pathname}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Join my call on Mera", url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      /* user cancelled */
    }
  };

  const retryConnection = () => {
    leftRef.current = false;
    setAttempt(1);
    setPhase("connecting");
    setSessionKey((k) => k + 1);
  };

  const statusText =
    phase === "connecting"
      ? attempt > 1
        ? `Connecting… (attempt ${attempt} of ${MAX_ATTEMPTS})`
        : "Connecting…"
      : phase === "reconnecting"
        ? `Reconnecting… (attempt ${attempt} of ${MAX_ATTEMPTS})`
        : formatDuration(elapsed);

  const showVideoStage = callType === "video" && phase === "connected";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background:
          "radial-gradient(120% 90% at 50% 0%, hsl(20 30% 12%) 0%, hsl(20 20% 6%) 55%, #0b0705 100%)",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Zego media stage */}
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          opacity: showVideoStage ? 1 : 0,
          pointerEvents: showVideoStage ? "auto" : "none",
          background: showVideoStage ? "#111" : "transparent",
        }}
      />

      {/* Header */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          paddingTop: "calc(14px + env(safe-area-inset-top, 0px))",
          paddingInline: 16,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <button
          onClick={() => setMinimizedInfo((v) => !v)}
          aria-label={minimizedInfo ? "Show call details" : "Hide call details"}
          style={roundBtn(48, "rgba(255,255,255,0.12)")}
        >
          <Minimize2 size={20} />
        </button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{peerName || "Mera call"}</div>
          <div style={{ fontSize: 14, opacity: 0.75, fontVariantNumeric: "tabular-nums" }}>
            {statusText}
          </div>
        </div>
        <button
          onClick={shareCall}
          aria-label="Share call link"
          style={roundBtn(48, "rgba(255,255,255,0.12)")}
        >
          <Share2 size={20} />
        </button>
      </div>

      {/* Avatar stage (voice call, or video before connect) */}
      {!showVideoStage && !minimizedInfo && (
        <div
          style={{
            position: "relative",
            zIndex: 2,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
          }}
        >
          <div
            style={{
              width: 190,
              height: 190,
              borderRadius: "50%",
              overflow: "hidden",
              animation:
                phase === "connected" ? undefined : "zego-pulse 1.9s ease-out infinite",
              boxShadow: "0 0 0 0 rgba(249,115,22,0.5)",
            }}
          >
            <Avatar src={peerAvatar ?? undefined} fallback={peerName || "?"} size="lg" className="!w-[190px] !h-[190px] text-4xl" />
          </div>
          {phase === "connecting" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.75, fontSize: 14 }}>
              <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
              Setting up a secure {callType === "video" ? "video" : "voice"} connection
            </div>
          )}
        </div>
      )}
      {showVideoStage && <div style={{ flex: 1 }} />}

      {/* Reconnecting banner */}
      {phase === "reconnecting" && (
        <div
          style={{
            position: "fixed",
            top: "calc(96px + env(safe-area-inset-top, 0px))",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 3,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 999,
            background: "rgba(239,68,68,0.92)",
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
          }}
        >
          <WifiOff size={15} />
          Reconnecting… attempt {attempt}/{MAX_ATTEMPTS}
        </div>
      )}

      {/* Control panel */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          margin: 12,
          marginBottom: "calc(14px + env(safe-area-inset-bottom, 0px))",
          borderRadius: 28,
          background: "rgba(20,16,14,0.72)",
          backdropFilter: "blur(16px)",
          padding: "22px 12px 18px",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          rowGap: 22,
          justifyItems: "center",
        }}
      >
        <ControlButton
          label="Audio"
          active={speakerOn}
          onClick={toggleSpeaker}
          icon={speakerOn ? <Volume2 size={26} /> : <Ear size={26} />}
        />
        <ControlButton
          label="Video"
          active={camOn}
          disabled={callType !== "video"}
          onClick={toggleCam}
          icon={camOn ? <VideoIcon size={26} /> : <VideoOff size={26} />}
        />
        <ControlButton
          label="Mute"
          active={!micOn}
          onClick={toggleMic}
          icon={micOn ? <Mic size={26} /> : <MicOff size={26} />}
        />
        <ControlButton
          label="More"
          active={showMore}
          onClick={() => setShowMore((v) => !v)}
          icon={<MoreHorizontal size={26} />}
        />
        <ControlButton label="Share" onClick={shareCall} icon={<Share2 size={26} />} />
        <ControlButton
          label="End"
          danger
          onClick={() => {
            try {
              if ("vibrate" in navigator) navigator.vibrate(30);
            } catch {
              /* noop */
            }
            handleLeave();
          }}
          icon={<PhoneOff size={26} />}
        />
      </div>

      {/* More sheet */}
      {showMore && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 4,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "flex-end",
          }}
          onClick={() => setShowMore(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              background: "#1a1512",
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              padding: "14px 16px calc(22px + env(safe-area-inset-bottom, 0px))",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <SheetRow icon={<SwitchCamera size={18} />} label="Switch camera" onClick={switchCamera} />
            <SheetRow
              icon={<Minimize2 size={18} />}
              label={minimizedInfo ? "Show call details" : "Hide call details"}
              onClick={() => {
                setMinimizedInfo((v) => !v);
                setShowMore(false);
              }}
            />
            <SheetRow
              icon={<RefreshCw size={18} />}
              label="Reconnect call"
              onClick={() => {
                setShowMore(false);
                retryConnection();
              }}
            />
            <SheetRow icon={<X size={18} />} label="Close" onClick={() => setShowMore(false)} />
          </div>
        </div>
      )}

      {/* Unable to reconnect */}
      {phase === "failed" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 5,
            background: "rgba(10,7,5,0.96)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 28,
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 92,
              height: 92,
              borderRadius: "50%",
              background: "rgba(239,68,68,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <WifiOff size={40} color="#ef4444" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Unable to reconnect</div>
          <div style={{ fontSize: 14, opacity: 0.7, maxWidth: 320 }}>
            We tried {MAX_ATTEMPTS} times but couldn't restore the connection. Check your network
            and try again.
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button
              onClick={retryConnection}
              style={{
                padding: "12px 22px",
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                color: "#fff",
                background: "linear-gradient(135deg, hsl(24 95% 55%), hsl(38 95% 58%))",
              }}
            >
              Try again
            </button>
            <button
              onClick={handleLeave}
              style={{
                padding: "12px 22px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "transparent",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              End call
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes zego-pulse {
          0% { box-shadow: 0 0 0 0 rgba(249,115,22,0.5); }
          70% { box-shadow: 0 0 0 26px rgba(249,115,22,0); }
          100% { box-shadow: 0 0 0 0 rgba(249,115,22,0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function roundBtn(size: number, bg: string): React.CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: "50%",
    background: bg,
    border: "none",
    color: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

function ControlButton({
  label,
  icon,
  onClick,
  active,
  danger,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const bg = danger ? "#ef4444" : active ? "#fff" : "rgba(255,255,255,0.12)";
  const color = danger ? "#fff" : active ? "#111" : "#fff";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <button
        onClick={() => {
          if (disabled) return;
          try {
            if ("vibrate" in navigator) navigator.vibrate(12);
          } catch {
            /* noop */
          }
          onClick();
        }}
        aria-label={label}
        aria-pressed={!!active}
        disabled={disabled}
        style={{
          ...roundBtn(66, bg),
          color,
          opacity: disabled ? 0.35 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
          transition: "background 150ms ease, transform 150ms ease",
        }}
      >
        {icon}
      </button>
      <span style={{ fontSize: 14, opacity: disabled ? 0.4 : 0.9 }}>{label}</span>
    </div>
  );
}

function SheetRow({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 10px",
        background: "transparent",
        border: "none",
        color: "#fff",
        fontSize: 15,
        cursor: "pointer",
        textAlign: "left",
        borderRadius: 12,
      }}
    >
      {icon}
      {label}
    </button>
  );
}
