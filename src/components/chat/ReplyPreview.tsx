import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReplyPreviewProps {
  replyToMessage: {
    id: string;
    text: string | null;
    senderName: string;
    isOwn: boolean;
  } | null;
  onCancel: () => void;
}

export const ReplyPreview = ({ replyToMessage, onCancel }: ReplyPreviewProps) => {
  if (!replyToMessage) return null;

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 border-l-2 border-primary rounded-r-lg mb-2">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-primary">
          Replying to {replyToMessage.isOwn ? "yourself" : replyToMessage.senderName}
        </p>
        <p className="text-sm text-muted-foreground truncate">
          {replyToMessage.text || "Media message"}
        </p>
      </div>
      <button
        onClick={onCancel}
        className="p-1 rounded-full hover:bg-muted transition-colors"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
};

interface QuotedMessageProps {
  originalMessage: {
    text: string | null;
    senderName: string;
    isOwn: boolean;
  };
  isOwnMessage: boolean;
}

export const QuotedMessage = ({ originalMessage, isOwnMessage }: QuotedMessageProps) => {
  return (
    <div
      className={cn(
        "p-2 rounded-lg mb-2 border-l-2",
        isOwnMessage
          ? "bg-primary-foreground/10 border-primary-foreground/50"
          : "bg-muted/50 border-primary"
      )}
    >
      <p className={cn(
        "text-xs font-medium",
        isOwnMessage ? "text-primary-foreground/70" : "text-primary"
      )}>
        {originalMessage.isOwn ? "You" : originalMessage.senderName}
      </p>
      <p className={cn(
        "text-xs truncate",
        isOwnMessage ? "text-primary-foreground/60" : "text-muted-foreground"
      )}>
        {originalMessage.text || "Media message"}
      </p>
    </div>
  );
};
