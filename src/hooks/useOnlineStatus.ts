import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, isToday, isYesterday, format } from "date-fns";

export const useOnlineStatus = (userId: string | undefined) => {
  const updateActivity = useCallback(async () => {
    if (!userId) return;
    
    try {
      await supabase.rpc("update_last_active");
    } catch (error) {
      console.error("Error updating activity:", error);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    // Update on mount
    updateActivity();

    // Update on user interactions
    const handleActivity = () => updateActivity();
    
    window.addEventListener("click", handleActivity);
    window.addEventListener("keypress", handleActivity);
    window.addEventListener("scroll", handleActivity);

    // Update periodically (every 2 minutes)
    const interval = setInterval(updateActivity, 2 * 60 * 1000);

    // Update on page visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        updateActivity();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("keypress", handleActivity);
      window.removeEventListener("scroll", handleActivity);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(interval);
    };
  }, [userId, updateActivity]);

  return { updateActivity };
};

export const getOnlineStatusText = (lastActiveAt: string | null): { text: string; isOnline: boolean } => {
  if (!lastActiveAt) {
    return { text: "Offline", isOnline: false };
  }

  const lastActive = new Date(lastActiveAt);
  const now = new Date();
  const diffMs = now.getTime() - lastActive.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  // Online if active in last 2 minutes
  if (diffMinutes < 2) {
    return { text: "Online", isOnline: true };
  }

  // Active X minutes ago (up to 60 minutes)
  if (diffMinutes < 60) {
    return { text: `Active ${diffMinutes} min ago`, isOnline: false };
  }

  // Active today
  if (isToday(lastActive)) {
    return { text: `Active today at ${format(lastActive, "h:mm a")}`, isOnline: false };
  }

  // Active yesterday
  if (isYesterday(lastActive)) {
    return { text: `Active yesterday`, isOnline: false };
  }

  // Active earlier
  return { text: `Active ${format(lastActive, "MMM d")}`, isOnline: false };
};
