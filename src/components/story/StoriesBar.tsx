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

interface StoriesBarProps {
  stories: StoryUser[];
}

export const StoriesBar = ({ stories }: StoriesBarProps) => {
  const { profile } = useAuth();

  return (
    <div className="card-base p-4 mb-4 overflow-hidden">
      <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
        {/* Your Story */}
        <Link to="/create?type=story" className="flex-shrink-0">
          <motion.div
            whileTap={{ scale: 0.95 }}
            className="flex flex-col items-center gap-1.5"
          >
            <div className="relative">
              <UserAvatar
                src={profile?.avatar_url}
                fallback={profile?.username || "You"}
                size="lg"
              />
              <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full gradient-primary border-2 border-background">
                <Plus className="h-3 w-3 text-primary-foreground" />
              </div>
            </div>
            <span className="text-xs font-medium text-foreground">Your story</span>
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
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-1.5"
            >
              <UserAvatar
                src={storyUser.avatar_url}
                fallback={storyUser.username}
                size="lg"
                hasStory
                hasUnseenStory={storyUser.hasUnseenStory}
              />
              <span className="text-xs text-foreground max-w-14 truncate">
                {storyUser.username}
              </span>
            </motion.div>
          </Link>
        ))}
      </div>
    </div>
  );
};
