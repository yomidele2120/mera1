import { useState, useEffect } from "react";
import { Search, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/common/Avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

interface ChatUser {
  id: string;
  chatId: string;
  username: string;
  avatar_url: string | null;
}

interface SharePostToMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  mediaUrl: string | null;
  caption?: string | null;
}

export const SharePostToMessageDialog = ({
  open,
  onOpenChange,
  postId,
  mediaUrl,
  caption,
}: SharePostToMessageDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [chats, setChats] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (open && user) {
      fetchChats();
    }
  }, [open, user]);

  const fetchChats = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("chats")
        .select(`
          id,
          user1_id,
          user2_id,
          user1:profiles!chats_user1_id_fkey (id, username, avatar_url),
          user2:profiles!chats_user2_id_fkey (id, username, avatar_url)
        `)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      if (error) throw error;

      const chatUsers: ChatUser[] = (data || []).map((chat: any) => {
        const otherUser = chat.user1_id === user.id ? chat.user2 : chat.user1;
        return {
          id: otherUser.id,
          chatId: chat.id,
          username: otherUser.username,
          avatar_url: otherUser.avatar_url,
        };
      });

      setChats(chatUsers);
    } catch (error) {
      console.error("Error fetching chats:", error);
    } finally {
      setLoading(false);
    }
  };

  const getMessageType = (url: string | null): string => {
    if (!url) return "text";
    const lower = url.toLowerCase();
    if (lower.match(/\.(mp4|mov|webm|avi)(\?|$)/)) return "video";
    if (lower.match(/\.(mp3|wav|ogg|m4a)(\?|$)/)) return "audio";
    if (lower.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/)) return "image";
    return "image"; // Default to image for media posts
  };

  const handleSend = async (chatUser: ChatUser) => {
    if (!user) return;

    setSending(chatUser.id);
    try {
      const messageType = getMessageType(mediaUrl);
      const messageData: any = {
        chat_id: chatUser.chatId,
        sender_id: user.id,
        message_type: messageType,
      };

      if (mediaUrl) {
        messageData.media_url = mediaUrl;
        if (caption) {
          messageData.text = caption;
        }
      } else {
        messageData.text = caption || "Shared a post";
        messageData.message_type = "text";
      }

      await supabase.from("messages").insert(messageData);

      toast({
        title: "Post shared",
        description: `Sent to ${chatUser.username}`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error sharing post:", error);
      toast({
        title: "Error",
        description: "Failed to share post",
        variant: "destructive",
      });
    } finally {
      setSending(null);
    }
  };

  const filteredChats = chats.filter((chat) =>
    chat.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Share Post</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="max-h-64 overflow-y-auto space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : filteredChats.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {searchQuery ? "No users found" : "No conversations yet"}
            </p>
          ) : (
            filteredChats.map((chat) => (
              <div
                key={chat.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <UserAvatar
                    src={chat.avatar_url}
                    fallback={chat.username}
                    size="sm"
                  />
                  <span className="font-medium">{chat.username}</span>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleSend(chat)}
                  disabled={sending === chat.id}
                >
                  {sending === chat.id ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
