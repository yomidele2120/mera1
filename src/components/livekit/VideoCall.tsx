import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  useRoomContext,
  useLocalParticipant,
  useParticipants,
  VideoTrack,
  useIsSpeaking,
} from "@livekit/components-react";
import { Track, Room, LocalParticipant, RemoteParticipant } from "livekit-client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  Volume2,
  VolumeX,
  SwitchCamera,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CallMode = "video" | "voice";

interface VideoCallProps {
  token: string;
  serverUrl: string;
  roomName: string;
  callMode?: CallMode;
  onDisconnected?: () => void;
  onRemoteJoined?: () => void;
  className?: string;
}

/* ---------- helpers ---------- */
function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function useCallTimer(active: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  return seconds;
}

/* ---------- voice mode ---------- */
function VoiceTile({ participant }: { participant: LocalParticipant | RemoteParticipant }) {
  const isSpeaking = useIsSpeaking(participant);
  const name = participant.name || participant.identity || "Guest";
  const initial = name.charAt(0).toUpperCase();
  const isLocal = participant instanceof LocalParticipant;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-3"
    >
      <div className="relative">
        {isSpeaking && (
          <motion.span
            className="absolute inset-0 rounded-full bg-primary/40"
            animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
        )}
        <div
          className={cn(
            "relative flex h-32 w-32 items-center justify-center rounded-full text-5xl font-semibold text-primary-foreground shadow-2xl ring-4 transition-all",
            "bg-gradient-to-br from-primary to-primary/70",
            isSpeaking ? "ring-primary/60" : "ring-white/10"
          )}
        >
          {initial}
        </div>
      </div>
      <div className="text-center">
        <p className="text-base font-medium text-white">
          {name} {isLocal && <span className="text-white/60">(You)</span>}
        </p>
        {isSpeaking && <p className="text-xs text-primary">Speaking…</p>}
      </div>
    </motion.div>
  );
}

function VoiceStage() {
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useParticipants().filter((p) => p.identity !== localParticipant.identity);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-12 px-6">
      {remoteParticipants.length === 0 ? (
        <div className="flex flex-col items-center gap-4 text-white/70">
          <motion.div
            className="h-24 w-24 rounded-full border-2 border-dashed border-white/30"
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          />
          <p className="text-sm">Waiting for others to join…</p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-10">
          {remoteParticipants.map((p) => (
            <VoiceTile key={p.identity} participant={p} />
          ))}
        </div>
      )}
      <div className="opacity-90">
        <VoiceTile participant={localParticipant} />
      </div>
    </div>
  );
}

/* ---------- video mode ---------- */
function VideoStage() {
  const { localParticipant } = useLocalParticipant();
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: true });
  const remoteTracks = tracks.filter(
    (t) => t.participant.identity !== localParticipant.identity
  );
  const localTrack = tracks.find((t) => t.participant.identity === localParticipant.identity);

  const main = remoteTracks[0];

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Main / remote view */}
      {main ? (
        <VideoTrack
          trackRef={main}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-900 via-slate-800 to-black">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-primary/80 text-4xl font-semibold text-primary-foreground">
            ?
          </div>
          <p className="text-sm text-white/70">Waiting for the other side…</p>
        </div>
      )}

      {/* Self PiP */}
      <motion.div
        drag
        dragMomentum={false}
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute right-4 top-4 h-40 w-28 cursor-grab overflow-hidden rounded-2xl border border-white/20 bg-black shadow-2xl active:cursor-grabbing"
      >
        {localTrack ? (
          <VideoTrack trackRef={localTrack} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary to-primary/60 text-2xl font-bold text-primary-foreground">
            {(localParticipant.name || "Y").charAt(0).toUpperCase()}
          </div>
        )}
      </motion.div>
    </div>
  );
}

/* ---------- controls ---------- */
function CallControls({
  mode,
  onLeave,
  room,
}: {
  mode: CallMode;
  onLeave: () => void;
  room: Room;
}) {
  const { localParticipant } = useLocalParticipant();
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(mode === "video");
  const [speakerOn, setSpeakerOn] = useState(true);

  const toggleMic = async () => {
    const next = !micOn;
    await localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  };

  const toggleCam = async () => {
    const next = !camOn;
    await localParticipant.setCameraEnabled(next);
    setCamOn(next);
  };

  const toggleSpeaker = () => {
    const next = !speakerOn;
    // Mute all remote audio tracks
    room.remoteParticipants.forEach((p) => {
      p.audioTrackPublications.forEach((pub) => {
        pub.track?.setMuted(!next);
      });
    });
    setSpeakerOn(next);
  };

  const flipCamera = async () => {
    try {
      const pub = localParticipant.getTrackPublication(Track.Source.Camera);
      const track = pub?.track;
      if (track && "restartTrack" in track) {
        const current = (track as any).mediaStreamTrack?.getSettings?.().facingMode;
        await (track as any).restartTrack({
          facingMode: current === "user" ? "environment" : "user",
        });
      }
    } catch {
      /* ignore — desktop browsers won't have multiple cameras */
    }
  };

  return (
    <div className="flex items-center justify-center gap-3 px-6 pb-8 pt-4">
      <CtrlButton
        active={micOn}
        onClick={toggleMic}
        label={micOn ? "Mute" : "Unmute"}
        Icon={micOn ? Mic : MicOff}
      />
      {mode === "video" && (
        <>
          <CtrlButton
            active={camOn}
            onClick={toggleCam}
            label={camOn ? "Stop video" : "Start video"}
            Icon={camOn ? VideoIcon : VideoOff}
          />
          <CtrlButton onClick={flipCamera} label="Flip camera" Icon={SwitchCamera} active />
        </>
      )}
      <CtrlButton
        active={speakerOn}
        onClick={toggleSpeaker}
        label={speakerOn ? "Mute speaker" : "Unmute speaker"}
        Icon={speakerOn ? Volume2 : VolumeX}
      />
      <button
        onClick={onLeave}
        aria-label="End call"
        className="ml-2 flex h-16 w-16 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg transition-transform active:scale-95"
      >
        <PhoneOff className="h-7 w-7" />
      </button>
    </div>
  );
}

function CtrlButton({
  Icon,
  onClick,
  label,
  active,
}: {
  Icon: typeof Mic;
  onClick: () => void;
  label: string;
  active: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex h-14 w-14 items-center justify-center rounded-full backdrop-blur-md transition-all active:scale-95",
        active
          ? "bg-white/15 text-white hover:bg-white/25"
          : "bg-white text-slate-900 hover:bg-white/90"
      )}
    >
      <Icon className="h-6 w-6" />
    </button>
  );
}

/* ---------- shell ---------- */
function CallUI({
  callMode,
  onDisconnected,
  onRemoteJoined,
}: {
  callMode: CallMode;
  onDisconnected?: () => void;
  onRemoteJoined?: () => void;
}) {
  const room = useRoomContext();
  const remoteParticipants = useParticipants().filter(
    (p) => p.identity !== room.localParticipant.identity
  );
  const connected = remoteParticipants.length > 0;
  const seconds = useCallTimer(connected);
  const remoteName = remoteParticipants[0]?.name || remoteParticipants[0]?.identity;

  // Fire onRemoteJoined exactly once when first remote arrives
  useEffect(() => {
    if (connected) onRemoteJoined?.();
  }, [connected, onRemoteJoined]);

  useEffect(() => {
    const handler = () => onDisconnected?.();
    room.on("disconnected", handler);
    return () => {
      room.off("disconnected", handler);
    };
  }, [room, onDisconnected]);

  const leave = async () => {
    try {
      if ("vibrate" in navigator) navigator.vibrate(20);
    } catch {
      /* noop */
    }
    await room.disconnect();
    onDisconnected?.();
  };

  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col",
        callMode === "video"
          ? "bg-black"
          : "bg-gradient-to-br from-slate-950 via-primary/25 to-slate-900"
      )}
    >
      <RoomAudioRenderer />

      {/* Top bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative z-10 flex items-center justify-between px-5 pt-[max(1.5rem,env(safe-area-inset-top))]"
      >
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
            {callMode === "video" ? "Video call" : "Voice call"}
          </p>
          <p className="text-base font-semibold text-white">
            {remoteName || "Connecting…"}
          </p>
        </div>
        <motion.div
          key={connected ? "live" : "ringing"}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium backdrop-blur-md",
            connected
              ? "bg-white/15 text-white"
              : "bg-primary/30 text-white animate-pulse"
          )}
        >
          {connected ? formatDuration(seconds) : "Ringing…"}
        </motion.div>
      </motion.div>

      {/* Stage */}
      {callMode === "video" ? <VideoStage /> : <VoiceStage />}

      {/* Controls */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 22, stiffness: 220 }}
      >
        <CallControls mode={callMode} onLeave={leave} room={room} />
      </motion.div>
    </div>
  );
}

export function VideoCall({
  token,
  serverUrl,
  callMode = "video",
  onDisconnected,
  onRemoteJoined,
  className = "",
}: VideoCallProps) {
  return (
    <div className={cn("h-full w-full", className)}>
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect
        video={callMode === "video"}
        audio={true}
        onDisconnected={onDisconnected}
        style={{ height: "100%", width: "100%" }}
      >
        <CallUI
          callMode={callMode}
          onDisconnected={onDisconnected}
          onRemoteJoined={onRemoteJoined}
        />
      </LiveKitRoom>
    </div>
  );
}
