import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface StackItem {
  id: string;
  item_type: "text" | "image" | "video" | "audio" | "voice" | "gif" | "sticker";
  content: string | null;
  media_url: string | null;
  duration_seconds: number | null;
  sort_order: number;
}

export interface MessageStackData {
  id: string;
  chat_id: string;
  sender_id: string;
  sender_persona_id: string | null;
  post_reference_id: string | null;
  topic_id: string | null;
  created_at: string;
  sender: {
    username: string;
    avatar_url: string | null;
  };
  items: StackItem[];
  reactions: Array<{
    id: string;
    emoji: string;
    user_id: string;
    item_id: string | null;
  }>;
  reply_to?: {
    id: string;
    preview: string;
    sender_name: string;
  } | null;
}

interface ComposerItem {
  id: string;
  type: "text" | "image" | "video" | "audio" | "voice";
  content?: string;
  file?: File;
  preview?: string;
}

export const useMessageStacks = (chatId: string | undefined, topicId?: string | null) => {
  const { user } = useAuth();
  const [stacks, setStacks] = useState<MessageStackData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStacks = useCallback(async () => {
    if (!chatId) return;

    try {
      // Fetch message stacks with items
      let query = supabase
        .from("message_stacks")
        .select(`
          id,
          chat_id,
          sender_id,
          sender_persona_id,
          post_reference_id,
          topic_id,
          created_at
        `)
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      if (topicId) {
        query = query.eq("topic_id", topicId);
      }

      const { data: stacksData, error: stacksError } = await query;

      if (stacksError) throw stacksError;

      if (!stacksData || stacksData.length === 0) {
        setStacks([]);
        setLoading(false);
        return;
      }

      // Fetch items for all stacks
      const stackIds = stacksData.map((s) => s.id);
      const { data: itemsData } = await supabase
        .from("stack_items")
        .select("*")
        .in("stack_id", stackIds)
        .order("sort_order", { ascending: true });

      // Fetch reactions
      const { data: reactionsData } = await supabase
        .from("stack_reactions")
        .select("*")
        .in("stack_id", stackIds);

      // Fetch sender profiles
      const senderIds = [...new Set(stacksData.map((s) => s.sender_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", senderIds);

      const profilesMap = new Map(
        profilesData?.map((p) => [p.id, { username: p.username, avatar_url: p.avatar_url }]) || []
      );

      // Fetch replies
      const { data: repliesData } = await supabase
        .from("stack_replies")
        .select(`
          reply_stack_id,
          parent_stack_id,
          parent_item_id
        `)
        .in("reply_stack_id", stackIds);

      // Build stack data with items and reactions
      const enrichedStacks: MessageStackData[] = stacksData.map((stack) => {
        const items = itemsData?.filter((item) => item.stack_id === stack.id) || [];
        const reactions = reactionsData?.filter((r) => r.stack_id === stack.id) || [];
        const senderProfile = profilesMap.get(stack.sender_id);
        
        // Find if this stack is a reply
        const replyInfo = repliesData?.find((r) => r.reply_stack_id === stack.id);
        let reply_to = null;

        if (replyInfo?.parent_stack_id) {
          const parentStack = stacksData.find((s) => s.id === replyInfo.parent_stack_id);
          const parentProfile = parentStack ? profilesMap.get(parentStack.sender_id) : null;
          const parentItems = itemsData?.filter((i) => i.stack_id === replyInfo.parent_stack_id) || [];
          const firstItem = parentItems[0];
          
          reply_to = {
            id: replyInfo.parent_stack_id,
            preview: firstItem?.content || firstItem?.item_type || "Media",
            sender_name: parentProfile?.username || "User",
          };
        }

        return {
          id: stack.id,
          chat_id: stack.chat_id,
          sender_id: stack.sender_id,
          sender_persona_id: stack.sender_persona_id,
          post_reference_id: stack.post_reference_id,
          topic_id: stack.topic_id,
          created_at: stack.created_at,
          sender: {
            username: senderProfile?.username || "Unknown",
            avatar_url: senderProfile?.avatar_url || null,
          },
          items: items.map((item) => ({
            id: item.id,
            item_type: item.item_type as StackItem["item_type"],
            content: item.content,
            media_url: item.media_url,
            duration_seconds: item.duration_seconds,
            sort_order: item.sort_order,
          })),
          reactions: reactions.map((r) => ({
            id: r.id,
            emoji: r.emoji,
            user_id: r.user_id,
            item_id: r.item_id,
          })),
          reply_to,
        };
      });

      setStacks(enrichedStacks);
    } catch (error) {
      console.error("Error fetching message stacks:", error);
    } finally {
      setLoading(false);
    }
  }, [chatId, topicId]);

  useEffect(() => {
    fetchStacks();
  }, [fetchStacks]);

  // Real-time subscription
  useEffect(() => {
    if (!chatId) return;

    const channel = supabase
      .channel(`stacks-${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_stacks",
          filter: `chat_id=eq.${chatId}`,
        },
        () => {
          fetchStacks();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stack_items",
        },
        () => {
          fetchStacks();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stack_reactions",
        },
        () => {
          fetchStacks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, fetchStacks]);

  const sendStack = async (
    items: ComposerItem[],
    replyToStackId?: string,
    replyToItemId?: string
  ): Promise<boolean> => {
    if (!chatId || !user || items.length === 0) return false;

    try {
      // Create the message stack
      const { data: newStack, error: stackError } = await supabase
        .from("message_stacks")
        .insert({
          chat_id: chatId,
          sender_id: user.id,
          topic_id: topicId || null,
        })
        .select("id")
        .single();

      if (stackError) throw stackError;

      // Upload media and create stack items
      const stackItems = await Promise.all(
        items.map(async (item, index) => {
          let mediaUrl: string | null = null;

          if (item.file) {
            const ext = item.file.name.split(".").pop()?.toLowerCase() || "bin";
            const fileName = `${user.id}/${chatId}/${Date.now()}_${index}.${ext}`;

            const { error: uploadError } = await supabase.storage
              .from("private-media")
              .upload(fileName, item.file);

            if (uploadError) throw uploadError;

            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            mediaUrl = `${supabaseUrl}/storage/v1/object/private-media/${fileName}`;
          }

          return {
            stack_id: newStack.id,
            item_type: item.type,
            content: item.content || null,
            media_url: mediaUrl,
            sort_order: index,
          };
        })
      );

      // Insert stack items
      const { error: itemsError } = await supabase
        .from("stack_items")
        .insert(stackItems);

      if (itemsError) throw itemsError;

      // Create reply reference if replying
      if (replyToStackId) {
        await supabase.from("stack_replies").insert({
          reply_stack_id: newStack.id,
          parent_stack_id: replyToStackId,
          parent_item_id: replyToItemId || null,
        });
      }

      return true;
    } catch (error) {
      console.error("Error sending stack:", error);
      return false;
    }
  };

  const addReaction = async (stackId: string, emoji: string, itemId?: string) => {
    if (!user) return;

    try {
      // Check if reaction already exists
      const { data: existing } = await supabase
        .from("stack_reactions")
        .select("id")
        .eq("stack_id", stackId)
        .eq("user_id", user.id)
        .eq("emoji", emoji)
        .maybeSingle();

      if (existing) {
        // Remove reaction
        await supabase.from("stack_reactions").delete().eq("id", existing.id);
      } else {
        // Add reaction
        await supabase.from("stack_reactions").insert({
          stack_id: stackId,
          item_id: itemId || null,
          user_id: user.id,
          emoji,
        });
      }
    } catch (error) {
      console.error("Error toggling reaction:", error);
    }
  };

  return {
    stacks,
    loading,
    sendStack,
    addReaction,
    refetch: fetchStacks,
  };
};
