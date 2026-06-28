import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, MessageSquarePlus, X, Loader2 } from "lucide-react";
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

const haptic = (pattern: number | number[] = 12) => {
  try {
    if ("vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    /* noop */
  }
};

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
  const [loading, setLoading] = useState<"reply" | "open" | null>(null);

  // Open-haptic
  useEffect(() => {
    if (isOpen) haptic([8, 30, 14]);
  }, [isOpen]);

  const findOrCreateChat = async (): Promise<string | null> => {
    if (!user || user.id === postUserId) {
      if (user?.id === postUserId) {
        toast({ title: "Can't message yourself" });
      }
      return null;
    }

    try {
      const { data: existingChat } = await supabase
        .from("chats")
        .select("id")
        .or(
          `and(user1_id.eq.${user.id},user2_id.eq.${postUserId}),and(user1_id.eq.${postUserId},user2_id.eq.${user.id})`
        )
        .maybeSingle();

      if (existingChat) return existingChat.id;

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
    haptic(10);
    setLoading("reply");
    const chatId = await findOrCreateChat();
    setLoading(null);

    if (chatId) {
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
    haptic(10);
    setLoading("open");
    const chatId = await findOrCreateChat();
    setLoading(null);

    if (chatId) navigate(`/messages/${chatId}`);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90]"
            onClick={onClose}
          />

          {/* Bottom sheet (mobile-first; centered on md+) */}
          <motion.div
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 32, stiffness: 320, mass: 0.8 }}
            className="fixed bottom-0 left-0 right-0 z-[100] mx-auto w-full max-w-md rounded-t-3xl bg-card border-t border-border shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.4)] md:bottom-1/2 md:translate-y-1/2 md:rounded-3xl md:border"
          >
            {/* Grab handle */}
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Message
                </p>
                <p className="text-base font-semibold text-foreground truncate">
                  @{postUsername}
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="h-9 w-9 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Options */}
            <div className="px-3 pb-5 pt-1 space-y-1">
              <SheetAction
                onClick={handleReplyPrivately}
                disabled={!!loading}
                loading={loading === "reply"}
                Icon={MessageCircle}
                title="Reply privately"
                subtitle={
                  caption
                    ? `Reply to "${caption.slice(0, 40)}${caption.length > 40 ? "…" : ""}"`
                    : "Send a private reply about this post"
                }
                tone="primary"
              />
              <SheetAction
                onClick={handleStartConversation}
                disabled={!!loading}
                loading={loading === "open"}
                Icon={MessageSquarePlus}
                title="Start conversation"
                subtitle={`Open a new chat with @${postUsername}`}
                tone="secondary"
              />
            </div>

            <div className="h-[env(safe-area-inset-bottom)]" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

function SheetAction({
  Icon,
  title,
  subtitle,
  onClick,
  disabled,
  loading,
  tone,
}: {
  Icon: typeof MessageCircle;
  title: string;
  subtitle: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone: "primary" | "secondary";
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-muted/70 active:bg-muted transition-colors text-left disabled:opacity-60"
    >
      <div
        className={
          "h-11 w-11 rounded-full flex items-center justify-center shrink-0 " +
          (tone === "primary"
            ? "bg-primary/15 text-primary"
            : "bg-secondary/30 text-secondary-foreground")
        }
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>
    </motion.button>
  );
}
