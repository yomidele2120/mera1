import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Bell, Heart, MessageCircle, UserPlus, Phone, PhoneMissed, Video } from "lucide-react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { UserAvatar } from "@/components/common/Avatar";
import { StickyHeader } from "@/components/common/StickyHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface MissedCall {
  id: string;
  caller_id: string;
  call_type: string;
  created_at: string;
  caller: {
    username: string;
    avatar_url: string | null;
    user_number: number | null;
  };
}

const NotificationsPage = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [missedCalls, setMissedCalls] = useState<MissedCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

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
    }
  };

  const fetchMissedCalls = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("call_logs")
        .select(`
          id,
          caller_id,
          call_type,
          created_at,
          caller:profiles!call_logs_caller_id_fkey (username, avatar_url, user_number)
        `)
        .eq("receiver_id", user.id)
        .in("status", ["missed", "rejected"])
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setMissedCalls((data || []) as MissedCall[]);
    } catch (error) {
      console.error("Error fetching missed calls:", error);
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchNotifications(), fetchMissedCalls()]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();

    // Subscribe to new notifications
    const notifChannel = supabase
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

    // Subscribe to missed calls
    const callChannel = supabase
      .channel("missed-calls")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "call_logs",
          filter: `receiver_id=eq.${user?.id}`,
        },
        () => {
          fetchMissedCalls();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(callChannel);
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

  const renderNotificationsList = () => {
    if (notifications.length === 0) {
      return (
        <div className="card-base p-8 text-center">
          <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No notifications yet</p>
        </div>
      );
    }

    return (
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
    );
  };

  const renderMissedCallsList = () => {
    if (missedCalls.length === 0) {
      return (
        <div className="card-base p-8 text-center">
          <PhoneMissed className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No missed calls</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {missedCalls.map((call, index) => (
          <motion.div
            key={call.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
          >
            <Link
              to={`/calls`}
              className="card-base p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors"
            >
              <div className="relative">
                <UserAvatar
                  src={call.caller?.avatar_url}
                  fallback={call.caller?.username || 'U'}
                  size="md"
                />
                <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-destructive flex items-center justify-center">
                  {call.call_type === 'video' ? (
                    <Video className="h-3 w-3 text-destructive-foreground" />
                  ) : (
                    <PhoneMissed className="h-3 w-3 text-destructive-foreground" />
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">
                  <span className="font-semibold">{call.caller?.username}</span>{" "}
                  {call.call_type === 'video' ? 'missed video call' : 'missed voice call'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
                </p>
              </div>
              <Phone className="h-5 w-5 text-muted-foreground" />
            </Link>
          </motion.div>
        ))}
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="-mx-4 md:mx-0">
        <StickyHeader title="Notifications" />
        
        <div className="px-4 pt-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="all" className="flex-1 gap-2">
              <Bell className="h-4 w-4" />
              All
            </TabsTrigger>
            <TabsTrigger value="calls" className="flex-1 gap-2">
              <PhoneMissed className="h-4 w-4" />
              Missed Calls
              {missedCalls.length > 0 && (
                <span className="ml-1 bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5 rounded-full">
                  {missedCalls.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            {renderNotificationsList()}
          </TabsContent>

            <TabsContent value="calls">
              {renderMissedCallsList()}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </MainLayout>
  );
};

export default NotificationsPage;
