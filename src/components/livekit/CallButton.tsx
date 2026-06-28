import { Phone, Video, PhoneOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { VideoCall, CallMode } from "./VideoCall";
import { useLiveKitCall } from "@/hooks/useLiveKitCall";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import { useRingtone } from "@/hooks/useRingtone";

interface CallButtonProps {
  roomName: string;
  myName: string;
  myIdentity: string;
  mode?: CallMode;
  disabled?: boolean;
}

const haptic = (p: number | number[] = 12) => {
  try {
    if ("vibrate" in navigator) navigator.vibrate(p);
  } catch {
    /* noop */
  }
};

export function CallButton({
  roomName,
  myName,
  myIdentity,
  mode = "video",
  disabled,
}: CallButtonProps) {
  const { status, token, livekitUrl, error, joinRoom, leaveRoom } = useLiveKitCall({
    participantName: myName,
    participantIdentity: myIdentity,
  });
  const { toast } = useToast();
  const { playRingtone, stopRingtone } = useRingtone();

  useEffect(() => {
    if (status === "error" && error) {
      toast({ title: "Call failed", description: error, variant: "destructive" });
      stopRingtone();
    }
  }, [status, error, toast, stopRingtone]);

  // Ringtone while connecting/ringing
  useEffect(() => {
    if (status === "connecting" || status === "connected") {
      playRingtone();
    } else {
      stopRingtone();
    }
    return () => stopRingtone();
  }, [status, playRingtone, stopRingtone]);

  const start = () => {
    haptic([12, 40, 18]);
    joinRoom(roomName);
  };

  const cancel = () => {
    haptic(20);
    stopRingtone();
    leaveRoom();
  };

  const onCallEnd = () => {
    haptic(20);
    stopRingtone();
    leaveRoom();
  };

  // Stop local ringtone once remote actually joins (handled inside VideoCall via onRemoteJoined)
  const handleRemoteJoined = () => stopRingtone();

  const showOverlay = status === "connecting" || status === "connected";

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        disabled={disabled || status === "connecting"}
        onClick={start}
        aria-label={mode === "video" ? "Start video call" : "Start voice call"}
      >
        {mode === "video" ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
      </Button>

      <AnimatePresence>
        {showOverlay && (
          <motion.div
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="fixed inset-0 z-[100] bg-black"
          >
            {status === "connecting" && (
              <RingingScreen mode={mode} name={myName} onCancel={cancel} />
            )}

            {status === "connected" && token && (
              <VideoCall
                token={token}
                serverUrl={livekitUrl}
                roomName={roomName}
                callMode={mode}
                onDisconnected={onCallEnd}
                onRemoteJoined={handleRemoteJoined}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function RingingScreen({
  mode,
  name,
  onCancel,
}: {
  mode: CallMode;
  name: string;
  onCancel: () => void;
}) {
  const initial = (name || "U").charAt(0).toUpperCase();
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between bg-gradient-to-br from-slate-950 via-primary/25 to-slate-900 text-white overflow-hidden">
      {/* ambient pulse */}
      <motion.div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-[120vmin] w-[120vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl"
        animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.55, 0.35] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10 pt-16 text-center">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
          {mode === "video" ? "Video call" : "Voice call"}
        </p>
        <p className="mt-1 text-2xl font-semibold">Ringing…</p>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-5">
        {/* Pulsing avatar */}
        <div className="relative flex items-center justify-center">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="absolute h-44 w-44 rounded-full border border-white/20"
              animate={{ scale: [1, 1.6], opacity: [0.45, 0] }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                delay: i * 0.6,
                ease: "easeOut",
              }}
            />
          ))}
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", damping: 16, stiffness: 200 }}
            className="relative flex h-36 w-36 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-5xl font-semibold text-primary-foreground shadow-2xl ring-2 ring-white/20"
          >
            {initial}
          </motion.div>
        </div>
        <p className="text-base font-medium text-white/90">{name || "Calling"}</p>
        <p className="text-xs text-white/50">Waiting for the other side to pick up…</p>
      </div>

      <div className="relative z-10 pb-12">
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={onCancel}
          aria-label="Cancel call"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-xl shadow-destructive/40"
        >
          <PhoneOff className="h-7 w-7" />
        </motion.button>
      </div>
    </div>
  );
}
