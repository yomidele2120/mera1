import { Phone, Video } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { VideoCall, CallMode } from "./VideoCall";
import { useLiveKitCall } from "@/hooks/useLiveKitCall";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

interface CallButtonProps {
  roomName: string;
  myName: string;
  myIdentity: string;
  mode?: CallMode;
  disabled?: boolean;
}

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

  useEffect(() => {
    if (status === "error" && error) {
      toast({ title: "Call failed", description: error, variant: "destructive" });
    }
  }, [status, error, toast]);

  const showOverlay = status === "connecting" || status === "connected";

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        disabled={disabled || status === "connecting"}
        onClick={() => joinRoom(roomName)}
        aria-label={mode === "video" ? "Start video call" : "Start voice call"}
      >
        {mode === "video" ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
      </Button>

      <AnimatePresence>
        {showOverlay && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black"
          >
            {status === "connecting" && (
              <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-gradient-to-br from-slate-900 via-primary/30 to-slate-900 text-white">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                  className="flex h-28 w-28 items-center justify-center rounded-full bg-primary/80 shadow-2xl"
                >
                  {mode === "video" ? (
                    <Video className="h-12 w-12 text-primary-foreground" />
                  ) : (
                    <Phone className="h-12 w-12 text-primary-foreground" />
                  )}
                </motion.div>
                <div className="text-center">
                  <p className="text-xs uppercase tracking-wider text-white/60">
                    {mode === "video" ? "Video call" : "Voice call"}
                  </p>
                  <p className="mt-1 text-xl font-semibold">Connecting…</p>
                </div>
                <Button variant="destructive" size="lg" className="rounded-full" onClick={leaveRoom}>
                  Cancel
                </Button>
              </div>
            )}

            {status === "connected" && token && (
              <VideoCall
                token={token}
                serverUrl={livekitUrl}
                roomName={roomName}
                callMode={mode}
                onDisconnected={leaveRoom}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
