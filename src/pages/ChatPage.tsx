import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Send, Image, Check, CheckCheck, Lock } from "lucide-react";
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
}

interface OtherUser {
  id: string;
  username: string;
  avatar_url: string | null;
  public_key: string | null;
}

interface DecryptedMessage extends Message {
  decryptedText?: string;
}

const ChatPage = () => {
  const { chatId } = useParams();
  const { user } = useAuth();
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [myPublicKeyString, setMyPublicKeyString] = useState<string | null>(null);
  const [sharedKey, setSharedKey] = useState<CryptoKey | null>(null);
  const [encryptionReady, setEncryptionReady] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Initialize encryption
  useEffect(() => {
    const initEncryption = async () => {
      try {
        const { privateKey: pk, publicKeyString } = await initializeEncryption();
        setPrivateKey(pk);
        setMyPublicKeyString(publicKeyString);

        // Update user's public key in profile if not set
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
          user1:profiles!chats_user1_id_fkey (id, username, avatar_url, public_key),
          user2:profiles!chats_user2_id_fkey (id, username, avatar_url, public_key)
        `)
        .eq("id", chatId)
        .single();

      if (error) throw error;

      const other = chatData.user1_id === user.id ? chatData.user2 : chatData.user1;
      setOtherUser(other);

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
  }, [messages]);

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim() || !user || !chatId) return;

    setSending(true);
    const messageText = newMessage;
    setNewMessage("");

    try {
      // If encryption is ready, send encrypted message
      if (sharedKey && myPublicKeyString) {
        const { encrypted, iv } = await encryptMessage(messageText, sharedKey);
        await supabase.from("messages").insert({
          chat_id: chatId,
          sender_id: user.id,
          encrypted_text: encrypted,
          iv: iv,
          sender_public_key: myPublicKeyString,
        });
      } else {
        // Fallback to unencrypted (shouldn't happen normally)
        await supabase.from("messages").insert({
          chat_id: chatId,
          sender_id: user.id,
          text: messageText,
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setNewMessage(messageText);
    } finally {
      setSending(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !chatId) return;

    setSending(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("media")
        .getPublicUrl(fileName);

      await supabase.from("messages").insert({
        chat_id: chatId,
        sender_id: user.id,
        media_url: urlData.publicUrl,
      });
    } catch (error) {
      console.error("Error uploading image:", error);
    } finally {
      setSending(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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
      <header className="flex items-center gap-3 border-b border-border p-4 bg-card">
        <Link to="/messages" className="md:hidden">
          <ArrowLeft className="h-6 w-6 text-foreground" />
        </Link>
        {otherUser && (
          <Link to={`/user/${otherUser.username}`} className="flex items-center gap-3 flex-1">
            <UserAvatar
              src={otherUser.avatar_url}
              fallback={otherUser.username}
              size="md"
            />
            <div>
              <span className="font-semibold text-foreground">{otherUser.username}</span>
              {encryptionReady && (
                <div className="flex items-center gap-1 text-xs text-green-500">
                  <Lock className="h-3 w-3" />
                  <span>End-to-end encrypted</span>
                </div>
              )}
            </div>
          </Link>
        )}
      </header>

      {/* Encryption notice */}
      {encryptionReady && (
        <div className="bg-green-500/10 border-b border-green-500/20 px-4 py-2 text-center">
          <p className="text-xs text-green-600 dark:text-green-400 flex items-center justify-center gap-1">
            <Lock className="h-3 w-3" />
            Messages are end-to-end encrypted. Only you and {otherUser?.username} can read them.
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                <div className="w-8">
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
                    : "bg-muted text-foreground rounded-bl-md"
                )}
              >
                {message.media_url && (
                  <img
                    src={message.media_url}
                    alt="Shared image"
                    className="rounded-lg mb-2 max-w-full"
                  />
                )}
                {messageText && <p className="text-sm">{messageText}</p>}
                <div
                  className={cn(
                    "flex items-center gap-1 mt-1",
                    isOwn ? "justify-end" : "justify-start"
                  )}
                >
                  <span className={cn("text-xs", isOwn ? "text-primary-foreground/70" : "text-muted-foreground")}>
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
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="border-t border-border p-4 bg-card safe-bottom">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <Image className="h-5 w-5 text-muted-foreground" />
          </button>
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
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
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
      </form>
    </div>
  );
};

export default ChatPage;
