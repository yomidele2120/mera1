import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Send, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { UserAvatar } from "@/components/common/Avatar";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { cn } from "@/lib/utils";

interface Friend {
  id: string;
  username: string;
  avatar_url: string | null;
  customName?: string | null;
}

interface ForwardMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: { text: string | null; mediaUrl: string | null; messageType: string }[];
  onForwarded: () => void;
}

export const ForwardMessageDialog = ({
  open,
  onOpenChange,
  messages,
  onForwarded,
}: ForwardMessageDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);

  useEffect(() => {
    const fetchFriends = async () => {
      if (!user) return;

      try {
        // Get mutual followers
        const { data: following } = await supabase
          .from("followers")
          .select("following_id")
          .eq("follower_id", user.id);

        const { data: followers } = await supabase
          .from("followers")
          .select("follower_id")
          .eq("following_id", user.id);

        const followingIds = following?.map((f) => f.following_id) || [];
        const followerIds = followers?.map((f) => f.follower_id) || [];
        const mutualIds = followingIds.filter((id) => followerIds.includes(id));

        // Get contacts for custom names
        const { data: contacts } = await supabase
          .from("contacts")
          .select("contact_user_id, custom_name")
          .eq("user_id", user.id);

        const contactMap = new Map(
          contacts?.map((c) => [c.contact_user_id, c.custom_name]) || []
        );

        // Get recent chat partners
        const { data: chats } = await supabase
          .from("chats")
          .select("user1_id, user2_id")
          .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

        const chatPartnerIds = chats?.map((c) =>
          c.user1_id === user.id ? c.user2_id : c.user1_id
        ) || [];

        const allUserIds = [...new Set([...mutualIds, ...chatPartnerIds])];

        if (allUserIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, username, avatar_url")
            .in("id", allUserIds);

          const friendsWithNames = (profiles || []).map((p) => ({
            ...p,
            customName: contactMap.get(p.id),
          }));

          setFriends(friendsWithNames);
        }
      } catch (error) {
        console.error("Error fetching friends:", error);
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchFriends();
    }
  }, [open, user]);

  const toggleFriend = (friendId: string) => {
    setSelectedFriends((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId]
    );
  };

  const handleForward = async () => {
    if (!user || selectedFriends.length === 0) return;

    setSending(true);
    try {
      for (const friendId of selectedFriends) {
        // Get or create chat
        let chatId: string;

        const { data: existingChat } = await supabase
          .from("chats")
          .select("id")
          .or(`and(user1_id.eq.${user.id},user2_id.eq.${friendId}),and(user1_id.eq.${friendId},user2_id.eq.${user.id})`)
          .single();

        if (existingChat) {
          chatId = existingChat.id;
        } else {
          const { data: newChat } = await supabase
            .from("chats")
            .insert({ user1_id: user.id, user2_id: friendId })
            .select()
            .single();

          if (!newChat) continue;
          chatId = newChat.id;
        }

        // Forward each message
        for (const msg of messages) {
          await supabase.from("messages").insert({
            chat_id: chatId,
            sender_id: user.id,
            text: msg.text ? `[Forwarded] ${msg.text}` : null,
            media_url: msg.mediaUrl,
            message_type: msg.messageType,
          });
        }
      }

      toast({ title: `Forwarded to ${selectedFriends.length} contact(s)` });
      onForwarded();
      onOpenChange(false);
      setSelectedFriends([]);
    } catch (error) {
      console.error("Error forwarding messages:", error);
      toast({ title: "Error forwarding messages", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const filteredFriends = friends.filter((f) =>
    (f.customName || f.username).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Forward to...</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <ScrollArea className="h-[300px]">
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : filteredFriends.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No contacts found</p>
          ) : (
            <div className="space-y-1">
              {filteredFriends.map((friend) => (
                <motion.button
                  key={friend.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => toggleFriend(friend.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg transition-colors",
                    selectedFriends.includes(friend.id)
                      ? "bg-primary/10"
                      : "hover:bg-accent"
                  )}
                >
                  <UserAvatar src={friend.avatar_url} fallback={friend.username} size="sm" />
                  <div className="flex-1 text-left">
                    <p className="font-medium text-sm">
                      {friend.customName || friend.username}
                    </p>
                    {friend.customName && (
                      <p className="text-xs text-muted-foreground">@{friend.username}</p>
                    )}
                  </div>
                  {selectedFriends.includes(friend.id) && (
                    <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                </motion.button>
              ))}
            </div>
          )}
        </ScrollArea>

        <Button
          onClick={handleForward}
          disabled={selectedFriends.length === 0 || sending}
          className="w-full"
        >
          <Send className="h-4 w-4 mr-2" />
          {sending ? "Sending..." : `Forward (${selectedFriends.length})`}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
