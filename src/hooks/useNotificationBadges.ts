import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface NotificationCounts {
  unreadMessages: number;
  unreadNotifications: number;
  pendingFriendRequests: number;
  missedCalls: number;
}

export const useNotificationBadges = () => {
  const { user } = useAuth();
  const [counts, setCounts] = useState<NotificationCounts>({
    unreadMessages: 0,
    unreadNotifications: 0,
    pendingFriendRequests: 0,
    missedCalls: 0,
  });

  const fetchCounts = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch unread messages count
      const { data: chats } = await supabase
        .from("chats")
        .select("id")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      const chatIds = chats?.map((c) => c.id) || [];
      
      let unreadMessages = 0;
      if (chatIds.length > 0) {
        const { count } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .in("chat_id", chatIds)
          .neq("sender_id", user.id)
          .eq("seen", false);
        
        unreadMessages = count || 0;
      }

      // Fetch unread notifications count
      const { count: unreadNotifications } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .eq("seen", false);

      // Fetch pending friend requests count
      const { count: pendingFriendRequests } = await supabase
        .from("friend_requests")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .eq("status", "pending");

      // Fetch missed calls (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: missedCalls } = await supabase
        .from("call_logs")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .eq("status", "missed")
        .gte("created_at", oneDayAgo);

      setCounts({
        unreadMessages: unreadMessages || 0,
        unreadNotifications: unreadNotifications || 0,
        pendingFriendRequests: pendingFriendRequests || 0,
        missedCalls: missedCalls || 0,
      });
    } catch (error) {
      console.error("Error fetching notification counts:", error);
    }
  }, [user]);

  useEffect(() => {
    fetchCounts();

    // Subscribe to realtime updates
    const suffix = `${user.id}-${Math.random().toString(36).slice(2, 8)}`;
    const channels = [
      supabase
        .channel(`badge-messages-${suffix}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "messages" },
          fetchCounts
        )
        .subscribe(),
      supabase
        .channel(`badge-notifications-${suffix}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications" },
          fetchCounts
        )
        .subscribe(),
      supabase
        .channel(`badge-friend-requests-${suffix}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "friend_requests" },
          fetchCounts
        )
        .subscribe(),
      supabase
        .channel(`badge-calls-${suffix}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "call_logs" },
          fetchCounts
        )
        .subscribe(),
    ];

    return () => {
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  }, [fetchCounts]);

  const totalUnread = counts.unreadMessages + counts.unreadNotifications + counts.pendingFriendRequests;

  return {
    ...counts,
    totalUnread,
    refetch: fetchCounts,
  };
};
