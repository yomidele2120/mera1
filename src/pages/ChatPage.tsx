import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Lock, MoreVertical, Ban, Camera, Smile, Reply, VideoIcon, Layers } from "lucide-react";
import { UserAvatar } from "@/components/common/Avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { PrivateMediaContent } from "@/components/chat/PrivateMediaContent";
import { ChatBackground } from "@/components/chat/ChatBackground";
import { ChatBackgroundPicker } from "@/components/chat/ChatBackgroundPicker";
import { VoiceRecorder } from "@/components/chat/VoiceRecorder";
import { MessageOptionsMenu } from "@/components/chat/MessageOptionsMenu";
import { DeleteChatButton } from "@/components/chat/DeleteChatButton";
import { MessageSelectionBar } from "@/components/chat/MessageSelectionBar";
import { ForwardMessageDialog } from "@/components/chat/ForwardMessageDialog";
import { GifStickerPicker } from "@/components/chat/GifStickerPicker";
import { CameraCapture } from "@/components/chat/CameraCapture";
import { VideoRecorder } from "@/components/chat/VideoRecorder";
import { MediaFilePicker } from "@/components/chat/MediaFilePicker";
import { ReplyPreview, QuotedMessage } from "@/components/chat/ReplyPreview";
import { ReadReceipt } from "@/components/chat/ReadReceipt";
import { TopicTabs } from "@/components/chat/TopicTabs";
import { MessageStacksList } from "@/components/chat/MessageStacksList";
import { StackComposer } from "@/components/chat/StackComposer";
import { useTypingIndicator, useTypingSubscription } from "@/hooks/useTypingIndicator";
import { useBlocking } from "@/hooks/useBlocking";
import { useOnlineStatus, getOnlineStatusText } from "@/hooks/useOnlineStatus";
import { useTopics } from "@/hooks/useTopics";
import { useMessageStacks } from "@/hooks/useMessageStacks";
import { OnlineStatusBadge } from "@/components/user/OnlineStatusBadge";

import { ReportDialog } from "@/components/user/ReportDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CallButton } from "@/components/livekit/CallButton";
import { useToast } from "@/hooks/use-toast";

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
  reply_to_id: string | null;
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
  const location = useLocation();
  const { user, profile } = useAuth();
  const { toast } = useToast();
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
  
  // Stacks mode toggle (new swipeable message stacks)
  const [useStacksMode, setUseStacksMode] = useState(true);
  const [replyToStack, setReplyToStack] = useState<{ stackId: string; itemId?: string; preview: string; senderName: string } | null>(null);
  
  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  
  // New feature states
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [videoRecorderOpen, setVideoRecorderOpen] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<{
    id: string;
    text: string | null;
    senderName: string;
    isOwn: boolean;
  } | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { handleTyping } = useTypingIndicator(chatId, user?.id);
  const { isBlocked, isAnyBlocked, blockUser, unblockUser, loading: blockLoading } = useBlocking(otherUser?.id);
  
  
  // Topic-based threads
  const { topics, activeTopicId, selectTopic, createTopic, updateTopic } = useTopics(chatId);
  
  // Message stacks hook
  const { stacks, sendStack, addReaction } = useMessageStacks(chatId, activeTopicId);
  
  // Update user activity
  useOnlineStatus(user?.id);
  
  // Get online status for other user
  const onlineStatus = getOnlineStatusText(otherUser?.last_active_at || null);
  
  // Handle post context from navigation (reply privately)
  const postContext = location.state?.replyToPost as { id: string; caption?: string; mediaUrl?: string; slideIndex?: number; username?: string } | undefined;
  
  // Set initial reply context if coming from post
  useEffect(() => {
    if (postContext && otherUser) {
      setReplyToStack({
        stackId: "post-context",
        preview: postContext.caption || "Replying to a post",
        senderName: postContext.username || otherUser.username,
      });
    }
  }, [postContext, otherUser]);
  
  
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

  const handleMessageDeleted = (messageId: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
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
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const deletedMsg = payload.old as { id: string };
          setMessages((prev) => prev.filter((msg) => msg.id !== deletedMsg.id));
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
    const replyId = replyToMessage?.id || null;
    setNewMessage("");
    setReplyToMessage(null);

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
          reply_to_id: replyId,
        });
      } else {
        await supabase.from("messages").insert({
          chat_id: chatId,
          sender_id: user.id,
          text: messageText,
          message_type: "text",
          reply_to_id: replyId,
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setNewMessage(messageText);
    } finally {
      setSending(false);
    }
  };

  const handleGifSelect = async (url: string, type: "gif" | "sticker") => {
    if (!user || !chatId) return;

    setSending(true);
    try {
      await supabase.from("messages").insert({
        chat_id: chatId,
        sender_id: user.id,
        media_url: url,
        message_type: type === "gif" ? "gif" : "sticker",
        reply_to_id: replyToMessage?.id || null,
      });
      setReplyToMessage(null);
    } catch (error) {
      console.error("Error sending GIF/sticker:", error);
    } finally {
      setSending(false);
    }
  };

  const handleCameraCapture = async (blob: Blob, type: "photo" | "video") => {
    if (!user || !chatId) return;

    setSending(true);
    try {
      const ext = type === "photo" ? "jpg" : "webm";
      const fileName = `${user.id}/${chatId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("private-media")
        .upload(fileName, blob);

      if (uploadError) throw uploadError;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const mediaUrl = `${supabaseUrl}/storage/v1/object/private-media/${fileName}`;

      await supabase.from("messages").insert({
        chat_id: chatId,
        sender_id: user.id,
        media_url: mediaUrl,
        message_type: type === "photo" ? "image" : "video",
        reply_to_id: replyToMessage?.id || null,
      });
      setReplyToMessage(null);
    } catch (error) {
      console.error("Error uploading camera capture:", error);
    } finally {
      setSending(false);
    }
  };

  const handleReply = (message: DecryptedMessage) => {
    const text = getMessageText(message);
    setReplyToMessage({
      id: message.id,
      text,
      senderName: message.sender_id === user?.id ? "yourself" : otherUser?.username || "User",
      isOwn: message.sender_id === user?.id,
    });
  };

  const getReplyMessage = (replyToId: string | null): { text: string | null; senderName: string; isOwn: boolean } | null => {
    if (!replyToId) return null;
    const original = messages.find((m) => m.id === replyToId);
    if (!original) return null;
    return {
      text: getMessageText(original),
      senderName: original.sender_id === user?.id ? "You" : otherUser?.username || "User",
      isOwn: original.sender_id === user?.id,
    };
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !chatId) return;

    setSending(true);
    try {
      const fileExt = file.name.split(".").pop()?.toLowerCase();
      const fileName = `${user.id}/${chatId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("private-media")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const mediaUrl = `${supabaseUrl}/storage/v1/object/private-media/${fileName}`;

      let messageType = "image";
      if (file.type.startsWith("video/")) {
        messageType = "video";
      } else if (file.type.startsWith("audio/")) {
        messageType = "audio";
      }

      await supabase.from("messages").insert({
        chat_id: chatId,
        sender_id: user.id,
        media_url: mediaUrl,
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
      const fileName = `${user.id}/${chatId}/${Date.now()}.webm`;

      const { error: uploadError } = await supabase.storage
        .from("private-media")
        .upload(fileName, blob);

      if (uploadError) throw uploadError;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const mediaUrl = `${supabaseUrl}/storage/v1/object/private-media/${fileName}`;

      await supabase.from("messages").insert({
        chat_id: chatId,
        sender_id: user.id,
        media_url: mediaUrl,
        message_type: "audio",
      });
    } catch (error) {
      console.error("Error uploading voice message:", error);
    } finally {
      setSending(false);
    }
  };

  const handleFilePickerSelect = async (file: File, type: "image" | "video" | "audio") => {
    if (!user || !chatId) return;

    setSending(true);
    try {
      const fileExt = file.name.split(".").pop()?.toLowerCase();
      const fileName = `${user.id}/${chatId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("private-media")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const mediaUrl = `${supabaseUrl}/storage/v1/object/private-media/${fileName}`;

      await supabase.from("messages").insert({
        chat_id: chatId,
        sender_id: user.id,
        media_url: mediaUrl,
        message_type: type,
        reply_to_id: replyToMessage?.id || null,
      });
      setReplyToMessage(null);
    } catch (error) {
      console.error("Error uploading file:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleVideoRecording = async (blob: Blob) => {
    if (!user || !chatId) return;

    setSending(true);
    try {
      const fileName = `${user.id}/${chatId}/${Date.now()}.webm`;

      const { error: uploadError } = await supabase.storage
        .from("private-media")
        .upload(fileName, blob);

      if (uploadError) throw uploadError;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const mediaUrl = `${supabaseUrl}/storage/v1/object/private-media/${fileName}`;

      await supabase.from("messages").insert({
        chat_id: chatId,
        sender_id: user.id,
        media_url: mediaUrl,
        message_type: "video",
        reply_to_id: replyToMessage?.id || null,
      });
      setReplyToMessage(null);
    } catch (error) {
      console.error("Error uploading video recording:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload video. Please try again.",
        variant: "destructive",
      });
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

  // Selection mode handlers
  const toggleMessageSelection = (messageId: string) => {
    setSelectedMessages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const handleLongPress = (messageId: string) => {
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedMessages(new Set([messageId]));
    }
  };

  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedMessages(new Set());
  };

  const handleCopySelected = () => {
    const selectedMsgs = messages.filter((m) => selectedMessages.has(m.id));
    const textContent = selectedMsgs
      .map((m) => getMessageText(m))
      .filter(Boolean)
      .join("\n");
    
    navigator.clipboard.writeText(textContent);
    toast({ title: "Copied to clipboard" });
    cancelSelection();
  };

  const handleForwardSelected = () => {
    setForwardDialogOpen(true);
  };

  const handleDeleteSelected = async () => {
    const ownMessages = messages.filter(
      (m) => selectedMessages.has(m.id) && m.sender_id === user?.id
    );

    for (const msg of ownMessages) {
      await supabase.from("messages").delete().eq("id", msg.id);
    }

    toast({ title: `Deleted ${ownMessages.length} message(s)` });
    cancelSelection();
  };

  const canDeleteSelected = messages
    .filter((m) => selectedMessages.has(m.id))
    .some((m) => m.sender_id === user?.id);

  const getMessagesToForward = () => {
    return messages
      .filter((m) => selectedMessages.has(m.id))
      .map((m) => ({
        text: getMessageText(m),
        mediaUrl: m.media_url,
        messageType: m.message_type,
      }));
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
      {/* Selection Bar */}
      <AnimatePresence>
        {selectionMode && (
          <MessageSelectionBar
            selectedCount={selectedMessages.size}
            onCancel={cancelSelection}
            onCopy={handleCopySelected}
            onForward={handleForwardSelected}
            onDelete={handleDeleteSelected}
            canDelete={canDeleteSelected}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <header className={cn(
        "flex items-center gap-3 border-b border-border p-4 bg-card z-10",
        selectionMode && "pt-16"
      )}>
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
        {chatId && user && otherUser && (
          <>
            <CallButton receiverId={otherUser.id} mode="voice" disabled={isAnyBlocked} />
            <CallButton receiverId={otherUser.id} mode="video" disabled={isAnyBlocked} />
          </>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setUseStacksMode(!useStacksMode)}>
              <Layers className="h-4 w-4 mr-2" />
              {useStacksMode ? "Classic View" : "Stacks View"}
            </DropdownMenuItem>
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
                <DropdownMenuSeparator />
                <DeleteChatButton chatId={chatId!} />
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* E2E Notice */}
      {encryptionReady && (
        <div className="bg-muted/50 px-3 py-1 text-center border-b border-border">
          <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
            <Lock className="h-2.5 w-2.5" />
            End-to-end encrypted
          </p>
        </div>
      )}

      {/* Topic-based Threads */}
      {topics.length > 0 && (
        <TopicTabs
          topics={topics}
          activeTopicId={activeTopicId}
          onSelectTopic={selectTopic}
          onCreateTopic={createTopic}
          onUpdateTopic={updateTopic}
        />
      )}

      {/* Messages with Background */}
      <ChatBackground backgroundUrl={chatBackground}>
        {useStacksMode ? (
          /* New Swipeable Message Stacks View */
          <MessageStacksList
            stacks={stacks}
            currentUserId={user?.id || ""}
            chatId={chatId || ""}
            isOtherTyping={isOtherTyping}
            onReply={(stackId, itemId) => {
              const stack = stacks.find((s) => s.id === stackId);
              if (stack) {
                const item = itemId ? stack.items.find((i) => i.id === itemId) : stack.items[0];
                setReplyToStack({
                  stackId,
                  itemId,
                  preview: item?.content || item?.item_type || "Media",
                  senderName: stack.sender.username,
                });
              }
            }}
            onReact={addReaction}
          />
        ) : (
          /* Legacy Linear Message Bubbles View */
          <div className="flex-1 overflow-y-auto p-4 space-y-3 h-full">
            {messages.map((message, index) => {
              const isOwn = message.sender_id === user?.id;
              const showAvatar =
                !isOwn &&
                (index === 0 || messages[index - 1].sender_id !== message.sender_id);
              const messageText = getMessageText(message);
              const isSelected = selectedMessages.has(message.id);

              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex gap-2 group",
                    isOwn ? "justify-end" : "justify-start",
                    isSelected && "bg-primary/10 -mx-2 px-2 py-1 rounded-lg"
                  )}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    handleLongPress(message.id);
                  }}
                >
                  {/* Selection checkbox */}
                  {selectionMode && (
                    <div className="flex items-center">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleMessageSelection(message.id)}
                      />
                    </div>
                  )}

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
                  
                  {/* Message options for own messages - left side */}
                  {isOwn && !selectionMode && (
                    <div className="flex items-center">
                      <MessageOptionsMenu
                        messageId={message.id}
                        senderId={message.sender_id}
                        messageText={messageText}
                        onDeleted={() => handleMessageDeleted(message.id)}
                      />
                    </div>
                  )}
                  
                  <div
                    onClick={() => selectionMode && toggleMessageSelection(message.id)}
                    onDoubleClick={() => !selectionMode && handleReply(message)}
                    className={cn(
                      "max-w-[70%] rounded-2xl px-4 py-2 cursor-pointer",
                      isOwn
                        ? "gradient-primary text-primary-foreground rounded-br-md"
                        : "bg-card text-foreground rounded-bl-md border border-border"
                    )}
                  >
                    {/* Quoted message */}
                    {message.reply_to_id && (() => {
                      const quoted = getReplyMessage(message.reply_to_id);
                      return quoted ? (
                        <QuotedMessage originalMessage={quoted} isOwnMessage={isOwn} />
                      ) : null;
                    })()}
                    
                    <PrivateMediaContent
                      messageType={message.message_type || "text"}
                      mediaUrl={message.media_url}
                      text={messageText}
                      isOwn={isOwn}
                      chatId={chatId!}
                    />
                    <div
                      className={cn(
                        "flex items-center gap-1.5 mt-1",
                        isOwn ? "justify-end" : "justify-start"
                      )}
                    >
                      <span className={cn("text-[10px]", isOwn ? "text-primary-foreground/70" : "text-muted-foreground")}>
                        {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                      </span>
                      {isOwn && (
                        <ReadReceipt
                          seen={message.seen}
                          createdAt={message.created_at}
                          isOwn={true}
                        />
                      )}
                    </div>
                  </div>
                  
                  {/* Reply button */}
                  {!selectionMode && (
                    <button
                      onClick={() => handleReply(message)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-muted transition-all"
                    >
                      <Reply className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                  
                  {/* Message options for other's messages - right side */}
                  {!isOwn && !selectionMode && (
                    <div className="flex items-center">
                      <MessageOptionsMenu
                        messageId={message.id}
                        senderId={message.sender_id}
                        messageText={messageText}
                      />
                    </div>
                  )}
                </motion.div>
              );
            })}
            
            {isOtherTyping && <TypingIndicator />}
            
            <div ref={messagesEndRef} />
          </div>
        )}
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
      ) : useStacksMode ? (
        /* New StackComposer for stacks mode */
        <StackComposer
          onSend={async (items) => {
            const composerItems = items.map((item) => ({
              id: item.id,
              type: item.type,
              content: item.content,
              file: item.file,
              preview: item.preview,
            }));
            await sendStack(composerItems, replyToStack?.stackId, replyToStack?.itemId);
            setReplyToStack(null);
          }}
          onOpenCamera={() => setCameraOpen(true)}
          onOpenGifPicker={() => setGifPickerOpen(true)}
          replyTo={replyToStack ? {
            id: replyToStack.stackId,
            preview: replyToStack.preview,
            senderName: replyToStack.senderName,
          } : null}
          onCancelReply={() => setReplyToStack(null)}
          disabled={sending}
        />
      ) : (
        /* Legacy input form */
        <form onSubmit={sendMessage} className="border-t border-border p-4 bg-card safe-bottom relative">
          {/* Reply Preview */}
          <ReplyPreview
            replyToMessage={replyToMessage}
            onCancel={() => setReplyToMessage(null)}
          />
          
          {/* GIF/Sticker Picker */}
          <GifStickerPicker
            open={gifPickerOpen}
            onClose={() => setGifPickerOpen(false)}
            onSelect={handleGifSelect}
          />
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              <Camera className="h-5 w-5 text-muted-foreground" />
            </button>
            
            <button
              type="button"
              onClick={() => setVideoRecorderOpen(true)}
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              <VideoIcon className="h-5 w-5 text-muted-foreground" />
            </button>
            
            <MediaFilePicker
              onFileSelect={handleFilePickerSelect}
              disabled={sending}
            />
            
            <button
              type="button"
              onClick={() => setGifPickerOpen(!gifPickerOpen)}
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              <Smile className="h-5 w-5 text-muted-foreground" />
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

      {/* Camera Capture */}
      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCameraCapture}
      />

      {/* Video Recorder */}
      <VideoRecorder
        open={videoRecorderOpen}
        onClose={() => setVideoRecorderOpen(false)}
        onRecordingComplete={handleVideoRecording}
      />

      {/* Forward Dialog */}
      <ForwardMessageDialog
        open={forwardDialogOpen}
        onOpenChange={setForwardDialogOpen}
        messages={getMessagesToForward()}
        onForwarded={cancelSelection}
      />
    </div>
  );
};

export default ChatPage;
