import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Grid3X3, Settings, MessageCircle, UserPlus, UserCheck, CalendarDays, MoreVertical, Play, Ban, Flag, ArrowLeft } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { UserAvatar } from "@/components/common/Avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { formatDistanceToNow } from "date-fns";
import { useBlocking } from "@/hooks/useBlocking";
import { getOnlineStatusText } from "@/hooks/useOnlineStatus";
import { OnlineStatusBadge } from "@/components/user/OnlineStatusBadge";
import { UserNumber } from "@/components/user/UserNumber";
import { BlockUserButton } from "@/components/user/BlockUserButton";
import { ReportDialog } from "@/components/user/ReportDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Profile {
  id: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  last_active_at: string | null;
  user_number: number | null;
}

interface Post {
  id: string;
  media_url: string;
  caption: string;
  post_type: string;
}

const ProfilePage = () => {
  const { username } = useParams();
  const { user, profile: currentUserProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  const isOwnProfile = !username || username === currentUserProfile?.username;
  const displayUsername = username || currentUserProfile?.username;
  
  const { isBlocked, blockUser, unblockUser, loading: blockLoading } = useBlocking(profile?.id);
  const onlineStatus = getOnlineStatusText(profile?.last_active_at || null);

  const fetchProfile = async () => {
    if (!displayUsername) return;

    try {
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", displayUsername)
        .maybeSingle();

      if (error) throw error;
      if (!profileData) {
        navigate("/404");
        return;
      }

      setProfile(profileData);

      // Fetch posts
      const { data: postsData } = await supabase
        .from("posts")
        .select("id, media_url, caption, post_type")
        .eq("user_id", profileData.id)
        .order("created_at", { ascending: false });

      setPosts((postsData as Post[]) || []);

      // Fetch followers count
      const { count: followers } = await supabase
        .from("followers")
        .select("*", { count: "exact", head: true })
        .eq("following_id", profileData.id);

      setFollowersCount(followers || 0);

      // Fetch following count
      const { count: following } = await supabase
        .from("followers")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", profileData.id);

      setFollowingCount(following || 0);

      // Check if current user is following
      if (user && user.id !== profileData.id) {
        const { data: followData } = await supabase
          .from("followers")
          .select("id")
          .eq("follower_id", user.id)
          .eq("following_id", profileData.id)
          .maybeSingle();

        setIsFollowing(!!followData);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [displayUsername, user]);

  const handleFollow = async () => {
    if (!user || !profile) return;

    try {
      if (isFollowing) {
        await supabase
          .from("followers")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", profile.id);

        setIsFollowing(false);
        setFollowersCount((prev) => prev - 1);
      } else {
        await supabase.from("followers").insert({
          follower_id: user.id,
          following_id: profile.id,
        });

        // Create notification
        await supabase.from("notifications").insert({
          receiver_id: profile.id,
          actor_id: user.id,
          type: "follow",
        });

        setIsFollowing(true);
        setFollowersCount((prev) => prev + 1);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const startChat = async () => {
    if (!user || !profile) return;

    try {
      // Check if chat exists
      const { data: existingChat } = await supabase
        .from("chats")
        .select("id")
        .or(
          `and(user1_id.eq.${user.id},user2_id.eq.${profile.id}),and(user1_id.eq.${profile.id},user2_id.eq.${user.id})`
        )
        .maybeSingle();

      if (existingChat) {
        navigate(`/messages/${existingChat.id}`);
      } else {
        // Create new chat
        const { data: newChat, error } = await supabase
          .from("chats")
          .insert({
            user1_id: user.id,
            user2_id: profile.id,
          })
          .select("id")
          .single();

        if (error) throw error;
        navigate(`/messages/${newChat.id}`);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  if (!profile) {
    return (
      <MainLayout>
        <div className="card-base p-8 text-center">
          <p className="text-muted-foreground">User not found</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="animate-fade-up">
        {/* Mobile header with settings for own profile or back button for others */}
        <div className="flex items-center justify-between mb-4 md:hidden">
          {!isOwnProfile ? (
            <button 
              onClick={() => navigate(-1)} 
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}
          {isOwnProfile && (
            <Link to="/settings" className="p-2 rounded-full hover:bg-muted transition-colors ml-auto">
              <Settings className="h-5 w-5 text-muted-foreground" />
            </Link>
          )}
        </div>
        
        {/* Profile Header */}
        <div className="card-base p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative">
              <UserAvatar
                src={profile.avatar_url}
                fallback={profile.username}
                size="xl"
              />
              {!isOwnProfile && <OnlineStatusBadge isOnline={onlineStatus.isOnline} className="h-4 w-4" />}
            </div>

            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row items-center gap-3 mb-2">
                <h1 className="font-display text-2xl font-bold text-foreground">
                  {profile.username}
                </h1>

                {isOwnProfile ? (
                  <Link to="/settings" className="hidden md:block">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Settings className="h-4 w-4" />
                      Edit Profile
                    </Button>
                  </Link>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      onClick={handleFollow}
                      variant={isFollowing ? "outline" : "default"}
                      size="sm"
                      className={isFollowing ? "" : "btn-primary"}
                    >
                      {isFollowing ? (
                        <>
                          <UserCheck className="h-4 w-4 mr-1" />
                          Following
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4 mr-1" />
                          Follow
                        </>
                      )}
                    </Button>
                    <Button onClick={startChat} variant="outline" size="sm">
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={isBlocked ? unblockUser : blockUser} disabled={blockLoading}>
                          <Ban className="h-4 w-4 mr-2" />
                          {isBlocked ? "Unblock" : "Block"}
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <ReportDialog reportedUserId={profile.id} trigger={<span className="flex items-center"><Flag className="h-4 w-4 mr-2" />Report</span>} />
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
              
              {/* Online Status & User ID */}
              {!isOwnProfile && (
                <p className={`text-sm mb-2 ${onlineStatus.isOnline ? "text-green-500" : "text-muted-foreground"}`}>
                  {onlineStatus.text}
                </p>
              )}
              <UserNumber userNumber={profile.user_number} className="mb-2 justify-center sm:justify-start" />

              {/* Stats */}
              <div className="flex justify-center sm:justify-start gap-6 mb-4">
                <div className="text-center">
                  <p className="font-bold text-foreground">{posts.length}</p>
                  <p className="text-sm text-muted-foreground">posts</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-foreground">{followersCount}</p>
                  <p className="text-sm text-muted-foreground">followers</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-foreground">{followingCount}</p>
                  <p className="text-sm text-muted-foreground">following</p>
                </div>
              </div>

              {/* Bio */}
              {profile.bio && (
                <p className="text-foreground mb-2">{profile.bio}</p>
              )}

              <div className="flex items-center justify-center sm:justify-start gap-1 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                <span>
                  Joined {formatDistanceToNow(new Date(profile.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Posts Grid */}
        <div className="mb-4 flex items-center gap-2 text-muted-foreground">
          <Grid3X3 className="h-5 w-5" />
          <span className="font-medium">Posts</span>
        </div>

        {posts.length === 0 ? (
          <div className="card-base p-8 text-center">
            <p className="text-muted-foreground">No posts yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1 sm:gap-2">
            {posts.map((post, index) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link to={`/post/${post.id}`}>
                  <div className="aspect-square overflow-hidden rounded-lg bg-muted relative">
                    {post.post_type === "video" || post.media_url?.match(/\.(mp4|mov|webm)$/i) ? (
                      <>
                        <video
                          src={post.media_url}
                          className="h-full w-full object-cover"
                          muted
                          preload="metadata"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Play className="h-8 w-8 text-white" fill="white" />
                        </div>
                      </>
                    ) : (
                      <img
                        src={post.media_url}
                        alt={post.caption}
                        className="h-full w-full object-cover hover:opacity-90 transition-opacity"
                        loading="lazy"
                      />
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default ProfilePage;
