import { Phone, Video, X } from "lucide-react";
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

      {status === "connected" && token && (
        <div className="fixed inset-0 z-[100] bg-background">
          <div className="absolute right-4 top-4 z-10">
            <Button variant="secondary" size="icon" onClick={leaveRoom} aria-label="Close call">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <VideoCall
            token={token}
            serverUrl={livekitUrl}
            roomName={roomName}
            callMode={mode}
            onDisconnected={leaveRoom}
          />
        </div>
      )}
    </>
  );
}
