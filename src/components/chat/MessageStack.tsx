import { useState, useRef } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/common/Avatar";
import { formatDistanceToNow } from "date-fns";
import { Heart, Reply } from "lucide-react";
import { StackItemRenderer } from "./StackItemRenderer";

export interface StackItem {
  id: string;
  item_type: "text" | "image" | "video" | "audio" | "voice" | "gif" | "sticker";
  content: string | null;
  media_url: string | null;
  duration_seconds: number | null;
  sort_order: number;
}

export interface MessageStackData {
  id: string;
  sender_id: string;
  sender: {
    username: string;
    avatar_url: string | null;
  };
  items: StackItem[];
  created_at: string;
  reactions: Array<{
    id: string;
    emoji: string;
    user_id: string;
    item_id: string | null;
  }>;
  reply_to?: {
    id: string;
    preview: string;
    sender_name: string;
  } | null;
}

interface MessageStackProps {
  stack: MessageStackData;
  chatId: string;
  isOwn: boolean;
  onReply: (stackId: string, itemId?: string) => void;
  onReact: (stackId: string, emoji: string, itemId?: string) => void;
}

const SWIPE_THRESHOLD = 50;
const EMOJI_OPTIONS = ["❤️", "😂", "😮", "😢", "🔥", "👏"];

export const MessageStack = ({ stack, chatId, isOwn, onReply, onReact }: MessageStackProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showReactions, setShowReactions] = useState(false);
  const [activeItemForReaction, setActiveItemForReaction] = useState<string | null>(null);
  const constraintsRef = useRef<HTMLDivElement>(null);

  const handleDragEnd = (_: any, info: PanInfo) => {
    const { offset, velocity } = info;
    
    if (Math.abs(offset.x) > SWIPE_THRESHOLD || Math.abs(velocity.x) > 500) {
      if (offset.x > 0 && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      } else if (offset.x < 0 && currentIndex < stack.items.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    }
  };

  const handleDoubleTap = (itemId?: string) => {
    onReact(stack.id, "❤️", itemId);
  };

  const handleLongPress = (itemId?: string) => {
    setActiveItemForReaction(itemId || null);
    setShowReactions(true);
  };

  const handleSelectEmoji = (emoji: string) => {
    onReact(stack.id, emoji, activeItemForReaction || undefined);
    setShowReactions(false);
    setActiveItemForReaction(null);
  };

  const currentItem = stack.items[currentIndex];
  const stackReactions = stack.reactions.filter(r => !r.item_id);
  const itemReactions = currentItem ? stack.reactions.filter(r => r.item_id === currentItem.id) : [];
  const allReactions = [...stackReactions, ...itemReactions];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex gap-2 mb-4",
        isOwn ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      {!isOwn && (
        <div className="flex-shrink-0 self-end">
          <UserAvatar
            src={stack.sender.avatar_url}
            fallback={stack.sender.username}
            size="sm"
          />
        </div>
      )}

      <div className={cn("flex flex-col max-w-[75%]", isOwn ? "items-end" : "items-start")}>
        {/* Reply reference */}
        {stack.reply_to && (
          <div className={cn(
            "text-xs px-3 py-1.5 rounded-lg mb-1 opacity-70",
            isOwn ? "bg-primary/20" : "bg-muted"
          )}>
            <span className="text-muted-foreground">Replying to </span>
            <span className="font-medium">{stack.reply_to.sender_name}</span>
            <p className="truncate mt-0.5">{stack.reply_to.preview}</p>
          </div>
        )}

        {/* Stack content */}
        <div
          ref={constraintsRef}
          className={cn(
            "relative rounded-2xl overflow-hidden",
            stack.items.length === 1 && stack.items[0].item_type === "text"
              ? cn(
                  "px-4 py-3",
                  isOwn ? "bg-primary text-primary-foreground" : "bg-muted"
                )
              : "bg-card shadow-lg"
          )}
        >
          {/* Swipeable content area */}
          <motion.div
            drag={stack.items.length > 1 ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            onDoubleClick={() => handleDoubleTap(currentItem?.id)}
            className="relative touch-pan-y"
            style={{ cursor: stack.items.length > 1 ? "grab" : "default" }}
          >
            <AnimatePresence mode="popLayout">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <StackItemRenderer
                  item={currentItem}
                  isOwn={isOwn}
                  chatId={chatId}
                  onLongPress={() => handleLongPress(currentItem?.id)}
                />
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* Swipe indicators */}
          {stack.items.length > 1 && (
            <div className="flex justify-center gap-1 py-2">
              {stack.items.map((_, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "h-1 rounded-full transition-all duration-300",
                    idx === currentIndex
                      ? "w-4 bg-primary"
                      : "w-1 bg-muted-foreground/30"
                  )}
                />
              ))}
            </div>
          )}

          {/* Reactions overlay */}
          <AnimatePresence>
            {showReactions && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 10 }}
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-card shadow-xl rounded-full px-2 py-1 flex gap-1 z-50"
              >
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleSelectEmoji(emoji)}
                    className="text-xl hover:scale-125 transition-transform p-1"
                  >
                    {emoji}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Reactions display */}
        {allReactions.length > 0 && (
          <div className={cn(
            "flex gap-1 mt-1",
            isOwn ? "justify-end" : "justify-start"
          )}>
            {Object.entries(
              allReactions.reduce((acc, r) => {
                acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).map(([emoji, count]) => (
              <span
                key={emoji}
                className="text-xs bg-muted rounded-full px-1.5 py-0.5"
              >
                {emoji} {count > 1 && count}
              </span>
            ))}
          </div>
        )}

        {/* Timestamp and actions */}
        <div className={cn(
          "flex items-center gap-2 mt-1 px-1",
          isOwn ? "flex-row-reverse" : "flex-row"
        )}>
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(stack.created_at), { addSuffix: true })}
          </span>
          
          <button
            onClick={() => onReply(stack.id, currentItem?.id)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Reply className="h-3 w-3" />
          </button>
          
          <button
            onClick={() => handleLongPress(currentItem?.id)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Heart className="h-3 w-3" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
