import { Phone, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CallButtonProps {
  onVoiceCall: () => void;
  onVideoCall: () => void;
  disabled?: boolean;
}

export const CallButton = ({ onVoiceCall, onVideoCall, disabled }: CallButtonProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={disabled}>
          <Phone className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onVoiceCall}>
          <Phone className="h-4 w-4 mr-2" />
          Voice Call
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onVideoCall}>
          <Video className="h-4 w-4 mr-2" />
          Video Call
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
