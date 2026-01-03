import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useTypingIndicator = (chatId: string | undefined, userId: string | undefined) => {
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  const setTyping = useCallback(async (isTyping: boolean) => {
    if (!chatId || !userId || isTypingRef.current === isTyping) return;
    
    isTypingRef.current = isTyping;
    
    try {
      const { data: existing } = await supabase
        .from("typing_status")
        .select("id")
        .eq("chat_id", chatId)
        .eq("user_id", userId)
        .single();

      if (existing) {
        await supabase
          .from("typing_status")
          .update({ is_typing: isTyping, updated_at: new Date().toISOString() })
          .eq("chat_id", chatId)
          .eq("user_id", userId);
      } else {
        await supabase
          .from("typing_status")
          .insert({ chat_id: chatId, user_id: userId, is_typing: isTyping });
      }
    } catch (error) {
      console.error("Error updating typing status:", error);
    }
  }, [chatId, userId]);

  const handleTyping = useCallback(() => {
    setTyping(true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setTyping(false);
    }, 2000);
  }, [setTyping]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Clear typing status on unmount
      if (chatId && userId) {
        setTyping(false);
      }
    };
  }, [chatId, userId, setTyping]);

  return { handleTyping, setTyping };
};

export const useTypingSubscription = (
  chatId: string | undefined, 
  userId: string | undefined,
  onTypingChange: (isTyping: boolean, typingUserId: string) => void
) => {
  useEffect(() => {
    if (!chatId || !userId) return;

    const channel = supabase
      .channel(`typing-${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "typing_status",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const data = payload.new as { user_id: string; is_typing: boolean } | undefined;
          if (data && data.user_id !== userId) {
            onTypingChange(data.is_typing, data.user_id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, userId, onTypingChange]);
};
