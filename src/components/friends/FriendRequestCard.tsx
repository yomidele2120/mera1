import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/common/Avatar";

interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
  sender?: {
    id: string;
    username: string;
    avatar_url: string | null;
    user_number: number | null;
  };
  receiver?: {
    id: string;
    username: string;
    avatar_url: string | null;
    user_number: number | null;
  };
}

interface FriendRequestCardProps {
  request: FriendRequest;
  type: "incoming" | "outgoing";
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onCancel?: (id: string) => void;
  loading?: boolean;
}

export const FriendRequestCard = ({
  request,
  type,
  onAccept,
  onReject,
  onCancel,
  loading,
}: FriendRequestCardProps) => {
  const user = type === "incoming" ? request.sender : request.receiver;

  if (!user) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border"
    >
      <Link to={`/user/${user.username}`}>
        <UserAvatar src={user.avatar_url} fallback={user.username} size="md" />
      </Link>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">@{user.username}</p>
        {user.user_number && (
          <p className="text-xs text-muted-foreground">{user.user_number}</p>
        )}
      </div>
      {type === "incoming" ? (
        <div className="flex gap-2">
          <Button
            size="icon"
            variant="default"
            onClick={() => onAccept?.(request.id)}
            disabled={loading}
            className="h-8 w-8"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={() => onReject?.(request.id)}
            disabled={loading}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onCancel?.(request.id)}
          disabled={loading}
        >
          Cancel
        </Button>
      )}
    </motion.div>
  );
};
