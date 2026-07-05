import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { UserAvatar } from "@/components/common/Avatar";
import { Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface StoryUser {
  id: string;
  username: string;
  avatar_url: string | null;
  hasUnseenStory: boolean;
}

interface FeedStoriesBarProps {
  stories: StoryUser[];
}

export const FeedStoriesBar = ({ stories }: FeedStoriesBarProps) => {
  const { profile } = useAuth();

  return (
    <div className="flex gap-3 overflow-x-auto hide-scrollbar py-2 -mx-4 px-4">
      {/* Your Story - First item */}
      <Link to="/create?type=story" className="flex-shrink-0">
        <motion.div
          whileTap={{ scale: 0.95 }}
          className="flex flex-col items-center gap-1"
        >
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl overflow-hidden bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xl font-bold text-primary">
                  {profile?.username?.charAt(0).toUpperCase() || "Y"}
                </span>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full gradient-primary border-2 border-background">
              <Plus className="h-3 w-3 text-primary-foreground" />
            </div>
          </div>
          <span className="text-xs text-muted-foreground max-w-16 truncate">Your Moment</span>
        </motion.div>
      </Link>

      {/* Other Stories */}
      {stories.map((storyUser, index) => (
        <Link
          key={storyUser.id}
          to={`/stories/${storyUser.username}`}
          className="flex-shrink-0"
        >
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
            whileTap={{ scale: 0.95 }}
            className="flex flex-col items-center gap-1"
          >
            <div
              className={`h-16 w-16 rounded-2xl overflow-hidden p-[2px] ${
                storyUser.hasUnseenStory ? "" : "bg-border/60"
              }`}
              style={
                storyUser.hasUnseenStory
                  ? { background: "var(--gradient-primary)" }
                  : undefined
              }
            >
              <div className="h-full w-full rounded-[14px] overflow-hidden bg-card">
                {storyUser.avatar_url ? (
                  <img
                    src={storyUser.avatar_url}
                    alt={storyUser.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <span className="text-lg font-bold text-muted-foreground">
                      {storyUser.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <span className="text-xs text-foreground max-w-16 truncate">
              {storyUser.username}
            </span>
          </motion.div>
        </Link>
      ))}
    </div>
  );
};
