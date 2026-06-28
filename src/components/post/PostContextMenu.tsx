import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, MessageSquarePlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface PostContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  postUserId: string;
  postUsername: string;
  slideIndex?: number;
  caption?: string | null;
  mediaUrl?: string | null;
}

export const PostContextMenu = ({
  isOpen,
  onClose,
  postId,
  postUserId,
  postUsername,
  slideIndex,
  caption,
  mediaUrl,
}: PostContextMenuProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const findOrCreateChat = async (): Promise<string | null> => {
    if (!user || user.id === postUserId) {
      if (user?.id === postUserId) {
        toast({ title: "Can't message yourself" });
      }
      return null;
    }

    try {
      // Check for existing chat
      const { data: existingChat } = await supabase
        .from("chats")
        .select("id")
        .or(
          `and(user1_id.eq.${user.id},user2_id.eq.${postUserId}),and(user1_id.eq.${postUserId},user2_id.eq.${user.id})`
        )
        .maybeSingle();

      if (existingChat) {
        return existingChat.id;
      }

      // Create new chat with post reference
      const { data: newChat, error } = await supabase
        .from("chats")
        .insert({
          user1_id: user.id,
          user2_id: postUserId,
          post_reference_id: postId,
          post_slide_index: slideIndex ?? null,
        })
        .select("id")
        .single();

      if (error) throw error;
      return newChat.id;
    } catch (error) {
      console.error("Error creating chat:", error);
      toast({
        title: "Error",
        description: "Could not start conversation",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleReplyPrivately = async () => {
    if (!user) {
      toast({ title: "Sign in required", variant: "destructive" });
      return;
    }

    setLoading(true);
    const chatId = await findOrCreateChat();
    setLoading(false);

    if (chatId) {
      // Navigate to chat with post context
      navigate(`/messages/${chatId}`, {
        state: {
          replyToPost: {
            id: postId,
            caption,
            mediaUrl,
            slideIndex,
            username: postUsername,
          },
        },
      });
    }
    onClose();
  };

  const handleStartConversation = async () => {
    if (!user) {
      toast({ title: "Sign in required", variant: "destructive" });
      return;
    }

    setLoading(true);
    const chatId = await findOrCreateChat();
    setLoading(false);

    if (chatId) {
      navigate(`/messages/${chatId}`);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Menu */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[280px] bg-card border border-border rounded-2xl shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-medium text-foreground">
                Message @{postUsername}
              </span>
              <button
                onClick={onClose}
                className="p-1 rounded-full hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Options */}
            <div className="p-2">
              <button
                onClick={handleReplyPrivately}
                disabled={loading}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted transition-colors text-left"
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <MessageCircle className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Reply privately</p>
                  <p className="text-xs text-muted-foreground">
                    Send a message about this post
                  </p>
                </div>
              </button>

              <button
                onClick={handleStartConversation}
                disabled={loading}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted transition-colors text-left"
              >
                <div className="h-10 w-10 rounded-full bg-secondary/10 flex items-center justify-center">
                  <MessageSquarePlus className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Start conversation</p>
                  <p className="text-xs text-muted-foreground">
                    Open a new chat with @{postUsername}
                  </p>
                </div>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
