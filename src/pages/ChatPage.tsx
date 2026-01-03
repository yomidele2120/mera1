import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Send, Image, Check, CheckCheck, Lock, MoreVertical, Ban } from "lucide-react";
import { UserAvatar } from "@/components/common/Avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  initializeEncryption,
  importPublicKey,
  deriveSharedKey,
  encryptMessage,
  decryptMessage,
} from "@/lib/encryption";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { MessageContent } from "@/components/chat/MessageContent";
import { ChatBackground } from "@/components/chat/ChatBackground";
import { ChatBackgroundPicker } from "@/components/chat/ChatBackgroundPicker";
import { VoiceRecorder } from "@/components/chat/VoiceRecorder";
import { useTypingIndicator, useTypingSubscription } from "@/hooks/useTypingIndicator";
import { useBlocking } from "@/hooks/useBlocking";
import { useOnlineStatus, getOnlineStatusText } from "@/hooks/useOnlineStatus";
import { OnlineStatusBadge } from "@/components/user/OnlineStatusBadge";
import { BlockUserButton } from "@/components/user/BlockUserButton";
import { ReportDialog } from "@/components/user/ReportDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Message {
  id: string;
  text: string | null;
  encrypted_text: string | null;
  iv: string | null;
  media_url: string | null;
  sender_id: string;
  created_at: string;
  seen: boolean;
  sender_public_key: string | null;
  message_type: string;
}

interface OtherUser {
  id: string;
  username: string;
  avatar_url: string | null;
  public_key: string | null;
  last_active_at: string | null;
}

interface DecryptedMessage extends Message {
  decryptedText?: string;
}

const ChatPage = () => {
  const { chatId } = useParams();
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [myPublicKeyString, setMyPublicKeyString] = useState<string | null>(null);
  const [sharedKey, setSharedKey] = useState<CryptoKey | null>(null);
  const [encryptionReady, setEncryptionReady] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [chatBackground, setChatBackground] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { handleTyping } = useTypingIndicator(chatId, user?.id);
  const { isBlocked, isBlockedByOther, isAnyBlocked, blockUser, unblockUser, loading: blockLoading } = useBlocking(otherUser?.id);
  
  // Update user activity
  useOnlineStatus(user?.id);
  
  // Get online status for other user
  const onlineStatus = getOnlineStatusText(otherUser?.last_active_at || null);
  
  useTypingSubscription(chatId, user?.id, useCallback((isTyping: boolean) => {
    setIsOtherTyping(isTyping);
  }, []));

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Load user's chat background
  useEffect(() => {
    if (profile?.chat_background_url) {
      setChatBackground(profile.chat_background_url);
    }
  }, [profile]);

  // Initialize encryption
  useEffect(() => {
    const initEncryption = async () => {
      try {
        const { privateKey: pk, publicKeyString } = await initializeEncryption();
        setPrivateKey(pk);
        setMyPublicKeyString(publicKeyString);

        if (user) {
          await supabase
            .from("profiles")
            .update({ public_key: publicKeyString })
            .eq("id", user.id);
        }
      } catch (error) {
        console.error("Error initializing encryption:", error);
      }
    };

    if (user) {
      initEncryption();
    }
  }, [user]);

  // Derive shared key when other user's public key is available
  useEffect(() => {
    const deriveKey = async () => {
      if (privateKey && otherUser?.public_key) {
        try {
          const otherPublicKey = await importPublicKey(otherUser.public_key);
          const shared = await deriveSharedKey(privateKey, otherPublicKey);
          setSharedKey(shared);
          setEncryptionReady(true);
        } catch (error) {
          console.error("Error deriving shared key:", error);
        }
      }
    };

    deriveKey();
  }, [privateKey, otherUser?.public_key]);

  // Decrypt messages when shared key is ready
  useEffect(() => {
    const decryptMessages = async () => {
      if (!sharedKey) return;

      const decrypted = await Promise.all(
        messages.map(async (msg) => {
          if (msg.encrypted_text && msg.iv && !msg.decryptedText) {
            try {
              const text = await decryptMessage(msg.encrypted_text, msg.iv, sharedKey);
              return { ...msg, decryptedText: text };
            } catch (error) {
              console.error("Error decrypting message:", error);
              return { ...msg, decryptedText: "[Unable to decrypt]" };
            }
          }
          return msg;
        })
      );

      setMessages(decrypted);
    };

    decryptMessages();
  }, [sharedKey, messages.length]);

  const fetchChat = async () => {
    if (!chatId || !user) return;

    try {
      const { data: chatData, error } = await supabase
        .from("chats")
        .select(`
          user1_id,
          user2_id,
          user1:profiles!chats_user1_id_fkey (id, username, avatar_url, public_key, last_active_at),
          user2:profiles!chats_user2_id_fkey (id, username, avatar_url, public_key, last_active_at)
        `)
        .eq("id", chatId)
        .single();

      if (error) throw error;

      const other = chatData.user1_id === user.id ? chatData.user2 : chatData.user1;
      setOtherUser(other as OtherUser);

      const { data: messagesData } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      setMessages((messagesData as DecryptedMessage[]) || []);

      await supabase
        .from("messages")
        .update({ seen: true })
        .eq("chat_id", chatId)
        .neq("sender_id", user.id)
        .eq("seen", false);
    } catch (error) {
      console.error("Error fetching chat:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChat();

    const channel = supabase
      .channel(`chat-${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const newMsg = payload.new as DecryptedMessage;
          setMessages((prev) => [...prev, newMsg]);

          if (newMsg.sender_id !== user?.id) {
            supabase
              .from("messages")
              .update({ seen: true })
              .eq("id", newMsg.id);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const updatedMsg = payload.new as DecryptedMessage;
          setMessages((prev) =>
            prev.map((msg) => (msg.id === updatedMsg.id ? { ...msg, ...updatedMsg } : msg))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOtherTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    handleTyping();
  };

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim() || !user || !chatId) return;

    setSending(true);
    const messageText = newMessage;
    setNewMessage("");

    try {
      if (sharedKey && myPublicKeyString) {
        const { encrypted, iv } = await encryptMessage(messageText, sharedKey);
        await supabase.from("messages").insert({
          chat_id: chatId,
          sender_id: user.id,
          encrypted_text: encrypted,
          iv: iv,
          sender_public_key: myPublicKeyString,
          message_type: "text",
        });
      } else {
        await supabase.from("messages").insert({
          chat_id: chatId,
          sender_id: user.id,
          text: messageText,
          message_type: "text",
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setNewMessage(messageText);
    } finally {
      setSending(false);
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !chatId) return;

    setSending(true);
    try {
      const fileExt = file.name.split(".").pop()?.toLowerCase();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("media")
        .getPublicUrl(fileName);

      // Determine message type
      let messageType = "image";
      if (file.type.startsWith("video/")) {
        messageType = "video";
      } else if (file.type.startsWith("audio/")) {
        messageType = "audio";
      }

      await supabase.from("messages").insert({
        chat_id: chatId,
        sender_id: user.id,
        media_url: urlData.publicUrl,
        message_type: messageType,
      });
    } catch (error) {
      console.error("Error uploading media:", error);
    } finally {
      setSending(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleVoiceRecording = async (blob: Blob) => {
    if (!user || !chatId) return;

    setSending(true);
    try {
      const fileName = `${user.id}/${Date.now()}.webm`;

      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(fileName, blob);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("media")
        .getPublicUrl(fileName);

      await supabase.from("messages").insert({
        chat_id: chatId,
        sender_id: user.id,
        media_url: urlData.publicUrl,
        message_type: "audio",
      });
    } catch (error) {
      console.error("Error uploading voice message:", error);
    } finally {
      setSending(false);
    }
  };

  const getMessageText = (message: DecryptedMessage): string | null => {
    if (message.decryptedText) return message.decryptedText;
    if (message.text) return message.text;
    if (message.encrypted_text) return "🔒 Encrypted message";
    return null;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-background md:relative md:inset-auto md:h-screen md:ml-64 lg:ml-72">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border p-4 bg-card z-10">
        <Link to="/messages" className="md:hidden">
          <ArrowLeft className="h-6 w-6 text-foreground" />
        </Link>
        {otherUser && (
          <Link to={`/user/${otherUser.username}`} className="flex items-center gap-3 flex-1">
            <div className="relative">
              <UserAvatar
                src={otherUser.avatar_url}
                fallback={otherUser.username}
                size="md"
              />
              <OnlineStatusBadge isOnline={onlineStatus.isOnline} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-foreground block truncate">{otherUser.username}</span>
              {isOtherTyping ? (
                <span className="text-xs text-primary">typing...</span>
              ) : (
                <span className={cn(
                  "text-[10px]",
                  onlineStatus.isOnline ? "text-green-500" : "text-muted-foreground"
                )}>
                  {onlineStatus.text}
                </span>
              )}
            </div>
          </Link>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <ChatBackgroundPicker
                currentBackground={chatBackground}
                onBackgroundChange={setChatBackground}
              />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {otherUser && (
              <>
                <DropdownMenuItem onClick={isBlocked ? unblockUser : blockUser} disabled={blockLoading}>
                  <Ban className="h-4 w-4 mr-2" />
                  {isBlocked ? "Unblock" : "Block"}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <ReportDialog reportedUserId={otherUser.id} trigger={<span className="flex items-center">Report</span>} />
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* E2E Notice - Smaller */}
      {encryptionReady && (
        <div className="bg-muted/50 px-3 py-1 text-center border-b border-border">
          <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
            <Lock className="h-2.5 w-2.5" />
            End-to-end encrypted
          </p>
        </div>
      )}

      {/* Messages with Background */}
      <ChatBackground backgroundUrl={chatBackground}>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 h-full">
          {messages.map((message, index) => {
            const isOwn = message.sender_id === user?.id;
            const showAvatar =
              !isOwn &&
              (index === 0 || messages[index - 1].sender_id !== message.sender_id);
            const messageText = getMessageText(message);

            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("flex gap-2", isOwn ? "justify-end" : "justify-start")}
              >
                {!isOwn && (
                  <div className="w-8 flex-shrink-0">
                    {showAvatar && otherUser && (
                      <UserAvatar
                        src={otherUser.avatar_url}
                        fallback={otherUser.username}
                        size="sm"
                      />
                    )}
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[70%] rounded-2xl px-4 py-2",
                    isOwn
                      ? "gradient-primary text-primary-foreground rounded-br-md"
                      : "bg-card text-foreground rounded-bl-md border border-border"
                  )}
                >
                  <MessageContent
                    messageType={message.message_type || "text"}
                    mediaUrl={message.media_url}
                    text={messageText}
                    isOwn={isOwn}
                  />
                  <div
                    className={cn(
                      "flex items-center gap-1 mt-1",
                      isOwn ? "justify-end" : "justify-start"
                    )}
                  >
                    <span className={cn("text-[10px]", isOwn ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                    </span>
                    {isOwn && (
                      message.seen ? (
                        <CheckCheck className="h-3 w-3 text-primary-foreground/70" />
                      ) : (
                        <Check className="h-3 w-3 text-primary-foreground/70" />
                      )
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
          
          {isOtherTyping && <TypingIndicator />}
          
          <div ref={messagesEndRef} />
        </div>
      </ChatBackground>

      {/* Input - Blocked state */}
      {isAnyBlocked ? (
        <div className="border-t border-border p-4 bg-card safe-bottom text-center">
          <p className="text-sm text-muted-foreground">
            {isBlocked ? "You have blocked this user." : "You can't send messages to this user."}
          </p>
          {isBlocked && (
            <Button variant="link" onClick={unblockUser} disabled={blockLoading}>
              Unblock to send messages
            </Button>
          )}
        </div>
      ) : (
        <form onSubmit={sendMessage} className="border-t border-border p-4 bg-card safe-bottom">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              <Image className="h-5 w-5 text-muted-foreground" />
            </button>
            
            <VoiceRecorder
              onRecordingComplete={handleVoiceRecording}
              disabled={sending}
            />
            
            <Input
              value={newMessage}
              onChange={handleInputChange}
              placeholder="Message..."
              className="flex-1 input-field"
              disabled={sending}
            />
            <Button
              type="submit"
              disabled={!newMessage.trim() || sending}
              size="icon"
              className="btn-primary h-10 w-10 rounded-full"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*"
            onChange={handleMediaUpload}
            className="hidden"
          />
        </form>
      )}
    </div>
  );
};

export default ChatPage;
