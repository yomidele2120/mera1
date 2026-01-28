import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { MessageStack, MessageStackData } from "@/components/chat/MessageStack";
import { TypingIndicator } from "@/components/chat/TypingIndicator";

interface MessageStacksListProps {
  stacks: MessageStackData[];
  currentUserId: string;
  isOtherTyping: boolean;
  onReply: (stackId: string, itemId?: string) => void;
  onReact: (stackId: string, emoji: string, itemId?: string) => void;
}

export const MessageStacksList = ({
  stacks,
  currentUserId,
  isOtherTyping,
  onReply,
  onReact,
}: MessageStacksListProps) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [stacks.length, isOtherTyping]);

  if (stacks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-muted-foreground"
        >
          <p className="text-sm">No messages yet</p>
          <p className="text-xs mt-1">Send a message to start the conversation</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {stacks.map((stack) => (
        <MessageStack
          key={stack.id}
          stack={stack}
          isOwn={stack.sender_id === currentUserId}
          onReply={onReply}
          onReact={onReact}
        />
      ))}

      {isOtherTyping && <TypingIndicator />}

      <div ref={endRef} />
    </div>
  );
};
