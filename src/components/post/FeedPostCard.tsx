import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Heart, MessageCircle, Bookmark } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { UserAvatar } from "@/components/common/Avatar";
import { MediaCarousel } from "@/components/post/MediaCarousel";
import { PostOptionsMenu } from "@/components/post/PostOptionsMenu";
import { PostContextMenu } from "@/components/post/PostContextMenu";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLongPress } from "@/hooks/useLongPress";

interface MediaItem {
  url: string;
  type: "image" | "video";
}

interface FeedPostCardProps {
  post: {
    id: string;
    user_id: string;
    caption: string | null;
    media_url: string | null;
    media_urls?: string[] | null;
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

export const FeedPostCard = ({ post, onLikeToggle, onCommentClick, onMediaClick }: FeedPostCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLiked, setIsLiked] = useState(
    post.likes?.some((like) => like.user_id === user?.id) ?? false
  );
  const [likesCount, setLikesCount] = useState(post.likes?.length ?? 0);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuSlideIndex, setContextMenuSlideIndex] = useState<number | undefined>();
  const doubleTapRef = useRef<number>(0);

  const postType = post.post_type || (post.media_url ? "image" : "text");

  // Build media items array
  const getMediaItems = (): MediaItem[] => {
    const items: MediaItem[] = [];
    
    // Check for multiple media URLs first
    if (post.media_urls && post.media_urls.length > 0) {
      post.media_urls.forEach((url) => {
        const extension = url.split('.').pop()?.toLowerCase();
        const isVideo = ['mp4', 'mov', 'webm'].includes(extension || '');
        items.push({ url, type: isVideo ? 'video' : 'image' });
      });
    } else if (post.media_url) {
      // Fallback to single media URL
      const extension = post.media_url.split('.').pop()?.toLowerCase();
      const isVideo = ['mp4', 'mov', 'webm'].includes(extension || '');
      items.push({ url: post.media_url, type: isVideo ? 'video' : 'image' });
    }
    
    return items;
  };

  const mediaItems = getMediaItems();

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

  const handleLongPress = (slideIndex?: number) => {
    if (post.user_id === user?.id) return; // Don't show for own posts
    setContextMenuSlideIndex(slideIndex);
    setContextMenuOpen(true);
  };

  const longPressHandlers = useLongPress({
    onLongPress: () => handleLongPress(),
    delay: 500,
  });

  return (
    <>
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl overflow-hidden border border-border"
      {...longPressHandlers}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <Link to={`/user/${post.profiles.username}`} className="flex items-center gap-3">
          <UserAvatar
            src={post.profiles.avatar_url}
            fallback={post.profiles.username}
            size="md"
          />
          <div>
            <p className="font-semibold text-sm text-foreground hover:underline">
              {post.profiles.username}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: false })} ago
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

      {/* Caption above media (like the reference) */}
      {post.caption && postType !== "text" && (
        <div className="px-4 pb-3">
          <p className="text-sm text-foreground leading-relaxed">
            {post.caption}
          </p>
        </div>
      )}

      {/* Text-only post */}
      {postType === "text" && (
        <div className="px-4 py-6 bg-gradient-to-br from-primary/10 to-secondary/10 min-h-24">
          <p className="text-base whitespace-pre-wrap">{post.text_content || post.caption}</p>
        </div>
      )}

      {/* Media Content */}
      {mediaItems.length > 0 && (
        <div onClick={onMediaClick}>
          <MediaCarousel
            mediaItems={mediaItems}
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
          </MediaCarousel>
        </div>
      )}

      {/* Actions - styled like the reference */}
      <div className="px-4 py-3">
        {/* Stats row */}
        <div className="flex items-center gap-3 mb-3 text-xs text-muted-foreground">
          <span>{likesCount} {likesCount === 1 ? "felt this" : "felt this"}</span>
          <span>·</span>
          <span>{post.comments?.length || 0} conversations</span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleLike}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                isLiked
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-foreground hover:bg-muted/80"
              )}
            >
              <Heart
                className={cn(
                  "h-4 w-4",
                  isLiked && "fill-primary text-primary"
                )}
              />
              <span>Feel</span>
            </motion.button>
            <button 
              onClick={handleCommentClick}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Talk</span>
            </button>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsBookmarked(!isBookmarked)}
            className="p-2"
          >
            <Bookmark
              className={cn(
                "h-5 w-5 transition-all",
                isBookmarked
                  ? "fill-foreground text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            />
          </motion.button>
        </div>
      </div>
    </motion.article>

    {/* Context Menu for Reply/Start Conversation */}
    <PostContextMenu
      isOpen={contextMenuOpen}
      onClose={() => setContextMenuOpen(false)}
      postId={post.id}
      postUserId={post.user_id}
      postUsername={post.profiles.username}
      slideIndex={contextMenuSlideIndex}
      caption={post.caption}
      mediaUrl={post.media_url}
    />
    </>
  );
};
