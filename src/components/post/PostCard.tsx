import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Heart, MessageCircle, Bookmark } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { UserAvatar } from "@/components/common/Avatar";
import { PostContent } from "@/components/post/PostContent";
import { PostOptionsMenu } from "@/components/post/PostOptionsMenu";
import { SharePostButton } from "@/components/post/SharePostButton";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface PostCardProps {
  post: {
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
  };
  onLikeToggle?: () => void;
  onCommentClick?: () => void;
  onMediaClick?: () => void;
}

export const PostCard = ({ post, onLikeToggle, onCommentClick, onMediaClick }: PostCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLiked, setIsLiked] = useState(
    post.likes?.some((like) => like.user_id === user?.id) ?? false
  );
  const [likesCount, setLikesCount] = useState(post.likes?.length ?? 0);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const doubleTapRef = useRef<number>(0);

  const postType = post.post_type || (post.media_url ? "image" : "text");

  const handleLike = async () => {
    if (!user) {
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

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - doubleTapRef.current < 300) {
      if (!isLiked) {
        handleLike();
      } else {
        setIsLikeAnimating(true);
        setTimeout(() => setIsLikeAnimating(false), 800);
      }
    }
    doubleTapRef.current = now;
  };

  const handlePostDeleted = () => {
    navigate("/");
  };

  const handleCommentClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onCommentClick) {
      onCommentClick();
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-base overflow-hidden p-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <Link to={`/user/${post.profiles.username}`} className="flex items-center gap-3">
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
        <PostOptionsMenu
          postId={post.id}
          postUserId={post.user_id}
          mediaUrl={post.media_url}
          caption={post.caption}
          onDeleted={handlePostDeleted}
        />
      </div>

      {/* Content */}
      <div onClick={onMediaClick}>
        <PostContent
          postType={postType}
          mediaUrl={post.media_url}
          textContent={post.text_content}
          caption={post.caption}
          onDoubleTap={handleDoubleTap}
        >
          {/* Double tap heart animation */}
          {isLikeAnimating && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <motion.div
                animate={{ scale: [1.2, 1] }}
                transition={{ duration: 0.3 }}
              >
                <Heart className="h-24 w-24 fill-primary-foreground text-primary-foreground drop-shadow-lg" />
              </motion.div>
            </motion.div>
          )}
        </PostContent>
      </div>

      {/* Actions */}
      <div className="p-4">
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
                    ? "fill-destructive text-destructive animate-heart-beat"
                    : "text-foreground group-hover:text-destructive"
                )}
              />
            </motion.button>
            <button onClick={handleCommentClick}>
              <MessageCircle className="h-6 w-6 text-foreground hover:text-muted-foreground transition-colors" />
            </button>
            <SharePostButton
              postId={post.id}
              mediaUrl={post.media_url}
              caption={post.caption}
            />
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

        {/* Likes count */}
        <p className="font-semibold text-sm text-foreground mb-2">
          {likesCount} {likesCount === 1 ? "like" : "likes"}
        </p>

        {/* Caption */}
        {post.caption && postType !== "text" && (
          <p className="text-sm text-foreground">
            <Link to={`/user/${post.profiles.username}`} className="font-semibold hover:underline">
              {post.profiles.username}
            </Link>{" "}
            {post.caption}
          </p>
        )}

        {/* Comments preview */}
        {post.comments?.length > 0 && (
          <button
            onClick={handleCommentClick}
            className="mt-2 block text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            View all {post.comments.length} comments
          </button>
        )}
      </div>
    </motion.article>
  );
};
