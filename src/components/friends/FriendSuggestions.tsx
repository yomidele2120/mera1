import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { UserPlus, Users, Sparkles } from "lucide-react";
import { UserAvatar } from "@/components/common/Avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

interface SuggestedFriend {
  id: string;
  username: string;
  avatar_url: string | null;
  user_number: number | null;
  mutualCount: number;
}

export const FriendSuggestions = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<SuggestedFriend[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!user) return;

      try {
        // Get my friends (accepted friend requests)
        const { data: myRequests } = await supabase
          .from("friend_requests")
          .select("sender_id, receiver_id")
          .eq("status", "accepted")
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

        const myFriendIds = new Set(
          myRequests?.map((r) =>
            r.sender_id === user.id ? r.receiver_id : r.sender_id
          ) || []
        );

        // Get pending requests I've sent
        const { data: pendingRequests } = await supabase
          .from("friend_requests")
          .select("receiver_id")
          .eq("sender_id", user.id)
          .eq("status", "pending");

        const pendingIds = new Set(pendingRequests?.map((r) => r.receiver_id) || []);

        // For each friend, get their friends (mutual connections)
        const mutualConnectionMap = new Map<string, number>();

        for (const friendId of myFriendIds) {
          const { data: friendsOfFriend } = await supabase
            .from("friend_requests")
            .select("sender_id, receiver_id")
            .eq("status", "accepted")
            .or(`sender_id.eq.${friendId},receiver_id.eq.${friendId}`);

          friendsOfFriend?.forEach((r) => {
            const suggestedId = r.sender_id === friendId ? r.receiver_id : r.sender_id;
            
            // Skip if it's me, already my friend, or already sent request
            if (
              suggestedId === user.id ||
              myFriendIds.has(suggestedId) ||
              pendingIds.has(suggestedId)
            ) {
              return;
            }

            const current = mutualConnectionMap.get(suggestedId) || 0;
            mutualConnectionMap.set(suggestedId, current + 1);
          });
        }

        // Sort by mutual count and take top 10
        const sortedSuggestions = Array.from(mutualConnectionMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);

        if (sortedSuggestions.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, username, avatar_url, user_number")
            .in(
              "id",
              sortedSuggestions.map(([id]) => id)
            );

          const suggestionsWithMutual = profiles?.map((p) => ({
            ...p,
            mutualCount: mutualConnectionMap.get(p.id) || 0,
          })) || [];

          // Sort again after fetching profiles
          suggestionsWithMutual.sort((a, b) => b.mutualCount - a.mutualCount);
          setSuggestions(suggestionsWithMutual);
        }
      } catch (error) {
        console.error("Error fetching suggestions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();
  }, [user]);

  const sendFriendRequest = async (receiverId: string) => {
    if (!user) return;

    setSendingRequest(receiverId);
    try {
      const { error } = await supabase.from("friend_requests").insert({
        sender_id: user.id,
        receiver_id: receiverId,
      });

      if (error) throw error;

      toast({ title: "Friend request sent!" });
      setSuggestions((prev) => prev.filter((s) => s.id !== receiverId));
    } catch (error) {
      toast({ title: "Error sending request", variant: "destructive" });
    } finally {
      setSendingRequest(null);
    }
  };

  if (loading || suggestions.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <Sparkles className="h-4 w-4" />
        Suggested Friends
      </h3>
      <div className="space-y-2">
        {suggestions.slice(0, 5).map((suggestion) => (
          <motion.div
            key={suggestion.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border"
          >
            <Link to={`/user/${suggestion.username}`}>
              <UserAvatar
                src={suggestion.avatar_url}
                fallback={suggestion.username}
                size="md"
              />
            </Link>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">
                {suggestion.username}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                {suggestion.mutualCount} mutual friend{suggestion.mutualCount !== 1 ? "s" : ""}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => sendFriendRequest(suggestion.id)}
              disabled={sendingRequest === suggestion.id}
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
