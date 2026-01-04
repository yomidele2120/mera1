import { useState } from "react";
import { Video, X, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface VideoCallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomName?: string;
}

export const VideoCallModal = ({ open, onOpenChange, roomName = "lovable-room" }: VideoCallModalProps) => {
  const callUrl = `https://1234fbf738ca469beb11.vercel.app/?room=${roomName}`;

  const handleOpenInNewTab = () => {
    window.open(callUrl, "_blank", "width=900,height=700,top=100,left=100");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Video Call
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={handleOpenInNewTab}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in new tab
            </Button>
          </div>
        </DialogHeader>
        <div className="w-full" style={{ maxWidth: "800px", margin: "auto" }}>
          <iframe
            src={callUrl}
            width="100%"
            height="600px"
            allow="camera; microphone; fullscreen; display-capture"
            style={{ border: "none" }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const VideoCallButton = ({ roomName }: { roomName?: string }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <Video className="h-4 w-4" />
        Join Video Call
      </Button>
      <VideoCallModal open={open} onOpenChange={setOpen} roomName={roomName} />
    </>
  );
};
