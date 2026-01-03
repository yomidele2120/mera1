import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MainLayout } from "@/components/layout/MainLayout";
import { PostCard } from "@/components/post/PostCard";
import { StoriesBar } from "@/components/story/StoriesBar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ImageOff } from "lucide-react";
import { Link } from "react-router-dom";

interface Post {
  id: string;
  user_id: string;
  caption: string;
  media_url: string;
  created_at: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
  likes: { user_id: string }[];
  comments: { id: string }[];
}

interface StoryUser {
  id: string;
  username: string;
  avatar_url: string | null;
  hasUnseenStory: boolean;
}

const FeedPage = () => {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [storyUsers, setStoryUsers] = useState<StoryUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeed = async () => {
    if (!user) return;

    try {
      // Get users the current user is following
      const { data: following } = await supabase
        .from("followers")
        .select("following_id")
        .eq("follower_id", user.id);

      const followingIds = following?.map((f) => f.following_id) || [];
      
      // Include own posts in feed
      const userIds = [...followingIds, user.id];

      if (userIds.length === 0) {
        setPosts([]);
        setLoading(false);
        return;
      }

      // Fetch posts from followed users
      const { data: postsData, error } = await supabase
        .from("posts")
        .select(`
          *,
          profiles!posts_user_id_fkey (username, avatar_url),
          likes (user_id),
          comments (id)
        `)
        .in("user_id", userIds)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setPosts(postsData || []);

      // Fetch stories from followed users
      const { data: storiesData } = await supabase
        .from("stories")
        .select(`
          user_id,
          id,
          profiles!stories_user_id_fkey (username, avatar_url),
          story_views (viewer_id)
        `)
        .in("user_id", followingIds)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      // Group stories by user
      const storyUsersMap = new Map<string, StoryUser>();
      storiesData?.forEach((story) => {
        if (!storyUsersMap.has(story.user_id)) {
          const hasUnseenStory = !story.story_views?.some((v) => v.viewer_id === user.id);
          storyUsersMap.set(story.user_id, {
            id: story.user_id,
            username: story.profiles.username,
            avatar_url: story.profiles.avatar_url,
            hasUnseenStory,
          });
        }
      });

      setStoryUsers(Array.from(storyUsersMap.values()));
    } catch (error) {
      console.error("Error fetching feed:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, [user]);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="animate-fade-up">
        {/* Mobile Header */}
        <div className="flex items-center justify-between mb-4 md:hidden">
          <h1 className="font-display text-2xl font-bold text-gradient">mera</h1>
        </div>

        {/* Stories */}
        {storyUsers.length > 0 && <StoriesBar stories={storyUsers} />}

        {/* Posts */}
        {posts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="card-base p-8 text-center"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <ImageOff className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">No posts yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Follow people to see their posts in your feed
                </p>
                <Link to="/search" className="btn-primary px-6 py-2 text-sm">
                  Find people to follow
                </Link>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onLikeToggle={fetchFeed}
              />
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default FeedPage;
