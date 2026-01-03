import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { UserAvatar } from "@/components/common/Avatar";
import { StoryProgress } from "@/components/story/StoryProgress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Story {
  id: string;
  media_url: string;
  created_at: string;
  user_id: string;
}

interface StoryUser {
  id: string;
  username: string;
  avatar_url: string | null;
  stories: Story[];
}

const STORY_DURATION = 5000;

const StoryViewerPage = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [storyUser, setStoryUser] = useState<StoryUser | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (username) fetchUserStories();
  }, [username]);

  const fetchUserStories = async () => {
    // First get the user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .eq("username", username)
      .single();

    if (profileError || !profile) {
      navigate("/");
      return;
    }

    // Then get their active stories
    const { data: stories, error: storiesError } = await supabase
      .from("stories")
      .select("id, media_url, created_at, user_id")
      .eq("user_id", profile.id)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });

    if (storiesError || !stories || stories.length === 0) {
      navigate("/");
      return;
    }

    setStoryUser({
      ...profile,
      stories,
    });
    setIsLoading(false);

    // Mark first story as viewed
    if (user && stories[0]) {
      markAsViewed(stories[0].id);
    }
  };

  const markAsViewed = async (storyId: string) => {
    if (!user) return;

    // Check if already viewed
    const { data: existing } = await supabase
      .from("story_views")
      .select("id")
      .eq("story_id", storyId)
      .eq("viewer_id", user.id)
      .single();

    if (!existing) {
      await supabase.from("story_views").insert({
        story_id: storyId,
        viewer_id: user.id,
      });
    }
  };

  const goToNext = useCallback(() => {
    if (!storyUser) return;

    if (currentIndex < storyUser.stories.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      markAsViewed(storyUser.stories[nextIndex].id);
    } else {
      navigate(-1);
    }
  }, [storyUser, currentIndex, navigate]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goToNext();
      if (e.key === "ArrowLeft") goToPrev();
      if (e.key === "Escape") navigate(-1);
    },
    [goToNext, goToPrev, navigate]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleTap = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isLeft = x < rect.width / 3;

    if (isLeft) {
      goToPrev();
    } else {
      goToNext();
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (!storyUser) return null;

  const currentStory = storyUser.stories[currentIndex];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black z-50 flex items-center justify-center"
    >
      {/* Story Container */}
      <div
        className="relative w-full max-w-md h-full max-h-[90vh] mx-auto"
        onClick={handleTap}
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Progress Bars */}
        <div className="absolute top-4 left-0 right-0 z-20">
          <StoryProgress
            count={storyUser.stories.length}
            current={currentIndex}
            duration={STORY_DURATION}
            isPaused={isPaused}
            onComplete={goToNext}
          />
        </div>

        {/* User Info */}
        <div className="absolute top-8 left-0 right-0 z-20 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <UserAvatar
              src={storyUser.avatar_url}
              fallback={storyUser.username}
              size="sm"
            />
            <div>
              <p className="font-semibold text-white text-sm">
                {storyUser.username}
              </p>
              <p className="text-xs text-white/70">
                {formatDistanceToNow(new Date(currentStory.created_at), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(-1);
            }}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="h-6 w-6 text-white" />
          </button>
        </div>

        {/* Story Image */}
        <AnimatePresence mode="wait">
          <motion.img
            key={currentStory.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            src={currentStory.media_url}
            alt="Story"
            className="w-full h-full object-contain"
          />
        </AnimatePresence>

        {/* Navigation Arrows (Desktop) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToPrev();
          }}
          className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="h-6 w-6 text-white" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <ChevronRight className="h-6 w-6 text-white" />
        </button>
      </div>
    </motion.div>
  );
};

export default StoryViewerPage;
