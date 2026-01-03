import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  ArrowLeft,
  MoreHorizontal,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { MainLayout } from "@/components/layout/MainLayout";
import { UserAvatar } from "@/components/common/Avatar";
import { CommentSection } from "@/components/post/CommentSection";
import { PostContent } from "@/components/post/PostContent";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Post {
  id: string;
  user_id: string;
  caption: string | null;
  media_url: string | null;
  text_content: string | null;
  post_type: string;
  created_at: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
  likes: { user_id: string }[];
  comments: { id: string }[];
}

const PostPage = () => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [post, setPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    if (postId) fetchPost();
  }, [postId]);

  const fetchPost = async () => {
    const { data, error } = await supabase
      .from("posts")
      .select(
        `
        id,
        user_id,
        caption,
        media_url,
        text_content,
        post_type,
        created_at,
        profiles (username, avatar_url),
        likes (user_id),
        comments (id)
      `
      )
      .eq("id", postId)
      .single();

    if (error || !data) {
      toast({
        title: "Post not found",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    const postData = data as unknown as Post;
    setPost(postData);
    setIsLiked(postData.likes?.some((like) => like.user_id === user?.id) ?? false);
    setLikesCount(postData.likes?.length ?? 0);
    setIsLoading(false);
  };

  const handleLike = async () => {
    if (!user || !post) return;

    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    setLikesCount((prev) => (newLikedState ? prev + 1 : prev - 1));

    if (newLikedState) {
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
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!post) return null;

  const postType = post.post_type || (post.media_url ? "image" : "text");

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto">
        {/* Mobile Header */}
        <div className="flex items-center gap-4 p-4 md:hidden border-b border-border">
          <button onClick={() => navigate(-1)}>
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="font-semibold text-lg">Post</h1>
        </div>

        <div className="card-base overflow-hidden md:flex">
          {/* Content Section */}
          <div className="md:w-[60%] bg-muted flex items-center justify-center overflow-hidden">
            <PostContent
              postType={postType}
              mediaUrl={post.media_url}
              textContent={post.text_content}
              caption={post.caption}
            />
          </div>

          {/* Details Section */}
          <div className="md:w-[40%] flex flex-col h-[70vh] md:h-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <Link
                to={`/user/${post.profiles.username}`}
                className="flex items-center gap-3"
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
              <button className="p-2 rounded-full hover:bg-muted transition-colors">
                <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {/* Caption */}
            {post.caption && postType !== "text" && (
              <div className="p-4 border-b border-border">
                <p className="text-sm text-foreground">
                  <Link
                    to={`/user/${post.profiles.username}`}
                    className="font-semibold hover:underline mr-2"
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
            <div className="border-t border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-4">
                  <motion.button whileTap={{ scale: 0.9 }} onClick={handleLike}>
                    <Heart
                      className={cn(
                        "h-6 w-6 transition-all duration-200",
                        isLiked
                          ? "fill-destructive text-destructive"
                          : "text-foreground hover:text-destructive"
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
      </div>
    </MainLayout>
  );
};

export default PostPage;
