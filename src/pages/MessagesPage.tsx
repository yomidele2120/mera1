import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Plus, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { UserAvatar } from "@/components/common/Avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AISearchBar } from "@/components/search/AISearchBar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { formatDistanceToNow } from "date-fns";
import { OnlineStatusBadge } from "@/components/user/OnlineStatusBadge";
import { getOnlineStatusText } from "@/hooks/useOnlineStatus";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ChatPreview {
  id: string;
  otherUser: {
    id: string;
    username: string;
    avatar_url: string | null;
    last_active_at: string | null;
  };
  lastMessage?: {
    text: string | null;
    created_at: string;
    seen: boolean;
    sender_id: string;
  };
}

// AI Chat Contact Component
const AIContactCard = () => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
  >
    <Link
      to="/messages/ai"
      className="card-base p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors border-l-4 border-l-primary"
    >
      <div className="relative">
        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-primary-foreground" />
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-card" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-foreground">MERA AI</p>
          <span className="text-xs text-primary font-medium">AI Assistant</span>
        </div>
        <p className="text-sm text-muted-foreground truncate">
          Ask me anything! I'm here to help 😊
        </p>
      </div>
    </Link>
  </motion.div>
);

const MessagesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [newChatOpen, setNewChatOpen] = useState(false);

  const fetchChats = async () => {
    if (!user) return;

    try {
      const { data: chatsData, error } = await supabase
        .from("chats")
        .select(`
          id,
          user1_id,
          user2_id,
          user1:profiles!chats_user1_id_fkey (id, username, avatar_url, last_active_at),
          user2:profiles!chats_user2_id_fkey (id, username, avatar_url, last_active_at)
        `)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get last message for each chat
      const chatsWithMessages: ChatPreview[] = await Promise.all(
        (chatsData || []).map(async (chat) => {
          const otherUser = chat.user1_id === user.id ? chat.user2 : chat.user1;

          const { data: lastMessage } = await supabase
            .from("messages")
            .select("text, created_at, seen, sender_id")
            .eq("chat_id", chat.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            id: chat.id,
            otherUser,
            lastMessage: lastMessage || undefined,
          };
        })
      );

      setChats(chatsWithMessages);
    } catch (error) {
      console.error("Error fetching chats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();

    // Subscribe to new messages
    const channel = supabase
      .channel("messages-list")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        () => {
          fetchChats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .ilike("username", `%${query}%`)
      .neq("id", user?.id)
      .limit(10);

    setSearchResults(data || []);
  };

  const startNewChat = async (otherUserId: string) => {
    if (!user) return;

    try {
      // Check if chat exists
      const { data: existingChat } = await supabase
        .from("chats")
        .select("id")
        .or(
          `and(user1_id.eq.${user.id},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${user.id})`
        )
        .maybeSingle();

      if (existingChat) {
        navigate(`/messages/${existingChat.id}`);
      } else {
        const { data: newChat, error } = await supabase
          .from("chats")
          .insert({
            user1_id: user.id,
            user2_id: otherUserId,
          })
          .select("id")
          .single();

        if (error) throw error;
        navigate(`/messages/${newChat.id}`);
      }

      setNewChatOpen(false);
    } catch (error) {
      console.error("Error creating chat:", error);
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

  return (
    <MainLayout>
      <div className="animate-fade-up">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-display text-2xl font-bold text-foreground">Messages</h1>
          <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="btn-primary">
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Message</DialogTitle>
              </DialogHeader>
              <div className="mt-4">
                <Input
                  placeholder="Search username..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    searchUsers(e.target.value);
                  }}
                  className="input-field"
                />
                <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => startNewChat(result.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors"
                    >
                      <UserAvatar
                        src={result.avatar_url}
                        fallback={result.username}
                        size="md"
                      />
                      <span className="font-medium text-foreground">{result.username}</span>
                    </button>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* AI Search Bar - Fixed at top */}
        <div className="sticky top-0 z-20 bg-background pb-4">
          <AISearchBar />
        </div>

        {/* MERA AI Contact - Always First */}
        <AIContactCard />

        {chats.length === 0 ? (
          <div className="card-base p-8 text-center mt-4">
            <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">No messages yet</p>
            <Button onClick={() => setNewChatOpen(true)} className="btn-primary">
              Start a conversation
            </Button>
          </div>
        ) : (
          <div className="space-y-2 mt-2">
            {chats.map((chat, index) => (
              <motion.div
                key={chat.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Link
                  to={`/messages/${chat.id}`}
                  className="card-base p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="relative">
                    <UserAvatar
                      src={chat.otherUser.avatar_url}
                      fallback={chat.otherUser.username}
                      size="lg"
                    />
                    <OnlineStatusBadge isOnline={getOnlineStatusText(chat.otherUser.last_active_at).isOnline} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-foreground">{chat.otherUser.username}</p>
                      {chat.lastMessage && (
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(chat.lastMessage.created_at), {
                            addSuffix: true,
                          })}
                        </p>
                      )}
                    </div>
                    {chat.lastMessage && (
                      <p className="text-sm text-muted-foreground truncate">
                        {chat.lastMessage.sender_id === user?.id && "You: "}
                        {chat.lastMessage.text || "Sent media"}
                      </p>
                    )}
                  </div>
                  {chat.lastMessage &&
                    !chat.lastMessage.seen &&
                    chat.lastMessage.sender_id !== user?.id && (
                      <div className="h-2 w-2 rounded-full gradient-primary" />
                    )}
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default MessagesPage;
