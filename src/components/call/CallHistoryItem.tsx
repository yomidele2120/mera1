import { Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Video } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { UserAvatar } from "@/components/common/Avatar";
import { UserNumber } from "@/components/user/UserNumber";
import { cn } from "@/lib/utils";
import type { CallLog } from "@/hooks/useCalling";

interface CallHistoryItemProps {
  call: CallLog;
  currentUserId: string;
  onClick?: () => void;
}

export const CallHistoryItem = ({ call, currentUserId, onClick }: CallHistoryItemProps) => {
  const isOutgoing = call.caller_id === currentUserId;
  const otherUser = isOutgoing ? call.receiver : call.caller;
  const isMissed = call.status === 'missed' || call.status === 'rejected';
  const isVideoCall = call.call_type === 'video';

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = () => {
    if (isMissed) {
      return <PhoneMissed className="h-4 w-4 text-destructive" />;
    }
    if (isOutgoing) {
      return <PhoneOutgoing className="h-4 w-4 text-green-500" />;
    }
    return <PhoneIncoming className="h-4 w-4 text-primary" />;
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer",
        "hover:bg-muted/50"
      )}
      onClick={onClick}
    >
      <UserAvatar
        src={otherUser?.avatar_url}
        fallback={otherUser?.username || 'U'}
        size="md"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground truncate">
            {otherUser?.username}
          </span>
          {isVideoCall && <Video className="h-3 w-3 text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {getStatusIcon()}
          <span className={cn(isMissed && "text-destructive")}>
            {isMissed ? (isOutgoing ? 'Not answered' : 'Missed') : 
             call.status === 'cancelled' ? 'Cancelled' :
             formatDuration(call.duration_seconds) || 'Completed'}
          </span>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
        </p>
        {otherUser?.user_number && (
          <UserNumber userNumber={otherUser.user_number} showCopyButton={false} className="text-[10px] justify-end" />
        )}
      </div>
    </div>
  );
};
