import { Phone, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCallContext } from "@/components/call/CallProvider";
import { useToast } from "@/hooks/use-toast";
import type { CallMode } from "./VideoCall";

interface CallButtonProps {
  /** The other participant's user id — required to signal them. */
  receiverId: string;
  mode?: CallMode;
  disabled?: boolean;
  /** @deprecated kept for backwards-compat; ignored (room_name comes from call_logs). */
  roomName?: string;
  /** @deprecated kept for backwards-compat. */
  myName?: string;
  /** @deprecated kept for backwards-compat. */
  myIdentity?: string;
}

const haptic = (p: number | number[] = 12) => {
  try {
    if ("vibrate" in navigator) navigator.vibrate(p);
  } catch {
    /* noop */
  }
};

export function CallButton({ receiverId, mode = "video", disabled }: CallButtonProps) {
  const { startCall, callStatus, isBlocked } = useCallContext();
  const { toast } = useToast();

  const inCall = callStatus === "calling" || callStatus === "connected";

  const start = async () => {
    if (isBlocked) {
      toast({
        title: "Unavailable",
        description: "You can't call this user.",
        variant: "destructive",
      });
      return;
    }
    haptic([12, 40, 18]);
    const call = await startCall(receiverId, mode === "video" ? "video" : "voice");
    if (!call) {
      toast({
        title: "Call failed",
        description: "Could not start the call. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={disabled || inCall}
      onClick={start}
      aria-label={mode === "video" ? "Start video call" : "Start voice call"}
    >
      {mode === "video" ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
    </Button>
  );
}
