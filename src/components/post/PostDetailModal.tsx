import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Heart, MessageCircle, Share2, Bookmark } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { UserAvatar } from "@/components/common/Avatar";
import { CommentSection } from "./CommentSection";
import { PostContent } from "./PostContent";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Post {
  id: string;
  user_id: string;
  caption: string | null;
  media_url: string | null;
  text_content?: string | null;
  post_type?: string;
  created_at: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
  likes: { user_id: string }[];
  comments: { id: string }[];
}

interface PostDetailModalProps {
  post: Post | null;
  isOpen: boolean;
  onClose: () => void;
  onLikeToggle?: () => void;
}

export const PostDetailModal = ({ post, isOpen, onClose, onLikeToggle }: PostDetailModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);

  const postType = post?.post_type || (post?.media_url ? "image" : "text");

  useEffect(() => {
    if (post) {
      setIsLiked(post.likes?.some((like) => like.user_id === user?.id) ?? false);
      setLikesCount(post.likes?.length ?? 0);
    }
  }, [post, user]);

  const handleLike = async () => {
    if (!user || !post) {
      toast({
        title: "Sign in required",
        description: "Please sign in to like posts",
        variant: "destructive",
      });
      return;
    }

    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    setLikesCount((prev) => (newLikedState ? prev + 1 : prev - 1));

    if (newLikedState) {
      setIsLikeAnimating(true);
      setTimeout(() => setIsLikeAnimating(false), 800);

      await supabase.from("likes").insert({
        user_id: user.id,
        post_id: post.id,
      });

      if (post.user_id !== user.id) {
        await supabase.from("notifications").insert({
          receiver_id: post.user_id,
          actor_id: user.id,
          type: "like",
          target_id: post.id,
        });
      }
    } else {
      await supabase
        .from("likes")
        .delete()
        .eq("user_id", user.id)
        .eq("post_id", post.id);
    }

    onLikeToggle?.();
  };

  if (!post) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent 
        side="bottom" 
        className="h-[95vh] md:h-[90vh] p-0 rounded-t-3xl md:rounded-t-2xl overflow-hidden"
      >
        <div className="flex flex-col md:flex-row h-full">
          {/* Media Section */}
          <div className="relative w-full md:w-1/2 lg:w-3/5 bg-muted flex items-center justify-center aspect-square md:aspect-auto md:h-full overflow-hidden">
            <PostContent
              postType={postType}
              mediaUrl={post.media_url}
              textContent={post.text_content}
              caption={post.caption}
            >
              {/* Double tap heart animation */}
              {isLikeAnimating && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1.2, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                >
                  <motion.div animate={{ scale: [1.2, 1] }} transition={{ duration: 0.3 }}>
                    <Heart className="h-24 w-24 fill-white text-white drop-shadow-lg" />
                  </motion.div>
                </motion.div>
              )}
            </PostContent>
          </div>

          {/* Details Section */}
          <div className="flex-1 flex flex-col h-full md:w-1/2 lg:w-2/5 bg-background">
            {/* Header */}
            <SheetHeader className="flex-shrink-0 p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <Link 
                  to={`/user/${post.profiles.username}`} 
                  className="flex items-center gap-3"
                  onClick={onClose}
                >
                  <UserAvatar
                    src={post.profiles.avatar_url}
                    fallback={post.profiles.username}
                    size="md"
                  />
                  <div>
                    <p className="font-semibold text-foreground hover:underline">
                      {post.profiles.username}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </Link>
              </div>
            </SheetHeader>

            {/* Caption */}
            {post.caption && postType !== "text" && (
              <div className="flex-shrink-0 p-4 border-b border-border">
                <p className="text-sm text-foreground">
                  <Link 
                    to={`/user/${post.profiles.username}`} 
                    className="font-semibold hover:underline mr-2"
                    onClick={onClose}
                  >
                    {post.profiles.username}
                  </Link>
                  {post.caption}
                </p>
              </div>
            )}

            {/* Comments */}
            <div className="flex-1 overflow-hidden">
              <CommentSection postId={post.id} postOwnerId={post.user_id} />
            </div>

            {/* Actions */}
            <div className="flex-shrink-0 border-t border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-4">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={handleLike}
                    className="group"
                  >
                    <Heart
                      className={cn(
                        "h-6 w-6 transition-all duration-200",
                        isLiked
                          ? "fill-destructive text-destructive"
                          : "text-foreground group-hover:text-destructive"
                      )}
                    />
                  </motion.button>
                  <MessageCircle className="h-6 w-6 text-foreground" />
                  <Share2 className="h-6 w-6 text-foreground hover:text-muted-foreground transition-colors cursor-pointer" />
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsBookmarked(!isBookmarked)}
                >
                  <Bookmark
                    className={cn(
                      "h-6 w-6 transition-all duration-200",
                      isBookmarked
                        ? "fill-foreground text-foreground"
                        : "text-foreground hover:text-muted-foreground"
                    )}
                  />
                </motion.button>
              </div>
              <p className="font-semibold text-sm text-foreground">
                {likesCount} {likesCount === 1 ? "like" : "likes"}
              </p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
