import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Topic } from "@/components/chat/TopicTabs";

export const useTopics = (chatId: string | undefined) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTopics = useCallback(async () => {
    if (!chatId || !user) {
      setTopics([]);
      setActiveTopicId(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("dm_topics")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const typedTopics: Topic[] = (data || []).map((t) => ({
        id: t.id,
        name: t.name,
        is_pinned: t.is_pinned,
        is_muted: t.is_muted,
        is_archived: t.is_archived,
        unread_count: 0, // TODO: Calculate unread count
      }));

      setTopics(typedTopics);

      // Set active topic to first non-archived topic or General
      if (!activeTopicId) {
        const generalTopic = typedTopics.find((t) => t.name === "General");
        const firstTopic = typedTopics.find((t) => !t.is_archived) || typedTopics[0];
        setActiveTopicId(generalTopic?.id || firstTopic?.id || null);
      }
    } catch (error) {
      console.error("Error fetching topics:", error);
    } finally {
      setLoading(false);
    }
  }, [chatId, user, activeTopicId]);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  const selectTopic = (topicId: string) => {
    setActiveTopicId(topicId);
  };

  const createTopic = async (name: string) => {
    if (!chatId || !user) return;

    try {
      const { data, error } = await supabase
        .from("dm_topics")
        .insert({
          chat_id: chatId,
          name: name.trim(),
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      const newTopic: Topic = {
        id: data.id,
        name: data.name,
        is_pinned: false,
        is_muted: false,
        is_archived: false,
        unread_count: 0,
      };

      setTopics((prev) => [...prev, newTopic]);
      setActiveTopicId(data.id);

      toast({
        title: "Topic created",
        description: `"${name}" topic is ready`,
      });
    } catch (error: any) {
      console.error("Error creating topic:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create topic",
        variant: "destructive",
      });
    }
  };

  const updateTopic = async (topicId: string, updates: Partial<Topic>) => {
    if (!chatId) return;

    try {
      const { error } = await supabase
        .from("dm_topics")
        .update({
          is_pinned: updates.is_pinned,
          is_muted: updates.is_muted,
          is_archived: updates.is_archived,
        })
        .eq("id", topicId);

      if (error) throw error;

      setTopics((prev) =>
        prev.map((t) => (t.id === topicId ? { ...t, ...updates } : t))
      );

      // If archived, switch to another topic
      if (updates.is_archived && activeTopicId === topicId) {
        const otherTopic = topics.find((t) => t.id !== topicId && !t.is_archived);
        setActiveTopicId(otherTopic?.id || null);
      }
    } catch (error: any) {
      console.error("Error updating topic:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update topic",
        variant: "destructive",
      });
    }
  };

  return {
    topics,
    activeTopicId,
    loading,
    selectTopic,
    createTopic,
    updateTopic,
    refreshTopics: fetchTopics,
  };
};
