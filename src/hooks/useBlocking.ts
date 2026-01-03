import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export const useBlocking = (otherUserId: string | undefined) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlockedByOther, setIsBlockedByOther] = useState(false);
  const [loading, setLoading] = useState(false);

  const checkBlockStatus = useCallback(async () => {
    if (!user || !otherUserId) return;

    try {
      // Check if I blocked them
      const { data: blockedByMe } = await supabase
        .from("blocked_users")
        .select("id")
        .eq("blocker_id", user.id)
        .eq("blocked_id", otherUserId)
        .maybeSingle();

      setIsBlocked(!!blockedByMe);

      // Check if they blocked me (we can't directly query this due to RLS, 
      // but we can use the is_blocked function)
      const { data: blockedStatus } = await supabase
        .rpc("is_blocked", { user_a: user.id, user_b: otherUserId });

      setIsBlockedByOther(blockedStatus && !blockedByMe);
    } catch (error) {
      console.error("Error checking block status:", error);
    }
  }, [user, otherUserId]);

  useEffect(() => {
    checkBlockStatus();
  }, [checkBlockStatus]);

  const blockUser = async () => {
    if (!user || !otherUserId) return;

    setLoading(true);
    try {
      await supabase.from("blocked_users").insert({
        blocker_id: user.id,
        blocked_id: otherUserId,
      });

      setIsBlocked(true);
      toast({
        title: "User blocked",
        description: "You won't receive messages from this user anymore.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const unblockUser = async () => {
    if (!user || !otherUserId) return;

    setLoading(true);
    try {
      await supabase
        .from("blocked_users")
        .delete()
        .eq("blocker_id", user.id)
        .eq("blocked_id", otherUserId);

      setIsBlocked(false);
      toast({
        title: "User unblocked",
        description: "You can now receive messages from this user.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isAnyBlocked = isBlocked || isBlockedByOther;

  return {
    isBlocked,
    isBlockedByOther,
    isAnyBlocked,
    blockUser,
    unblockUser,
    loading,
    checkBlockStatus,
  };
};
