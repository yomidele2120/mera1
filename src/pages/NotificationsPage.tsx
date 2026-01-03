import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Bell, Heart, MessageCircle, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { UserAvatar } from "@/components/common/Avatar";
import { BackButton } from "@/components/common/BackButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  type: "follow" | "like" | "comment" | "message";
  target_id: string | null;
  created_at: string;
  seen: boolean;
  actor: {
    username: string;
    avatar_url: string | null;
  };
}

const NotificationsPage = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select(`
          id,
          type,
          target_id,
          created_at,
          seen,
          actor:profiles!notifications_actor_id_fkey (username, avatar_url)
        `)
        .eq("receiver_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications((data || []) as Notification[]);

      // Mark as seen
      await supabase
        .from("notifications")
        .update({ seen: true })
        .eq("receiver_id", user.id)
        .eq("seen", false);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Subscribe to new notifications
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `receiver_id=eq.${user?.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "like":
        return <Heart className="h-4 w-4 text-destructive fill-destructive" />;
      case "comment":
        return <MessageCircle className="h-4 w-4 text-primary" />;
      case "follow":
        return <UserPlus className="h-4 w-4 text-primary" />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getNotificationText = (notification: Notification) => {
    switch (notification.type) {
      case "like":
        return "liked your post";
      case "comment":
        return "commented on your post";
      case "follow":
        return "started following you";
      case "message":
        return "sent you a message";
      default:
        return "";
    }
  };

  const getNotificationLink = (notification: Notification) => {
    switch (notification.type) {
      case "like":
      case "comment":
        return `/post/${notification.target_id}`;
      case "follow":
        return `/user/${notification.actor.username}`;
      case "message":
        return "/messages";
      default:
        return "#";
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

  return (
    <MainLayout>
      <div className="animate-fade-up">
        <div className="flex items-center gap-3 mb-6">
          <BackButton className="md:hidden" />
          <h1 className="font-display text-2xl font-bold text-foreground">Notifications</h1>
        </div>

        {notifications.length === 0 ? (
          <div className="card-base p-8 text-center">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification, index) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Link
                  to={getNotificationLink(notification)}
                  className={`card-base p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors ${
                    !notification.seen ? "bg-primary/5 border-primary/20" : ""
                  }`}
                >
                  <div className="relative">
                    <UserAvatar
                      src={notification.actor.avatar_url}
                      fallback={notification.actor.username}
                      size="md"
                    />
                    <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-background flex items-center justify-center">
                      {getNotificationIcon(notification.type)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      <span className="font-semibold">{notification.actor.username}</span>{" "}
                      {getNotificationText(notification)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!notification.seen && (
                    <div className="h-2 w-2 rounded-full gradient-primary" />
                  )}
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default NotificationsPage;
