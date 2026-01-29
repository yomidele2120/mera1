import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Image, Mic, Camera, X, Plus, Smile, Square, Trash2, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";


interface ComposerItem {
  id: string;
  type: "text" | "image" | "video" | "audio" | "voice";
  content?: string;
  file?: File;
  preview?: string;
  duration?: number;
}

interface StackComposerProps {
  onSend: (items: ComposerItem[]) => void;
  onOpenCamera: () => void;
  onOpenGifPicker: () => void;
  replyTo?: { id: string; preview: string; senderName: string } | null;
  onCancelReply?: () => void;
  disabled?: boolean;
}

export const StackComposer = ({
  onSend,
  onOpenCamera,
  onOpenGifPicker,
  replyTo,
  onCancelReply,
  disabled = false,
}: StackComposerProps) => {
  const [items, setItems] = useState<ComposerItem[]>([]);
  const [textInput, setTextInput] = useState("");
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [voicePreview, setVoicePreview] = useState<{ blob: Blob; url: string } | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const addTextItem = () => {
    if (textInput.trim()) {
      setItems([...items, {
        id: generateId(),
        type: "text",
        content: textInput.trim(),
      }]);
      setTextInput("");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    files.forEach((file) => {
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      const isAudio = file.type.startsWith("audio/");
      
      if (isImage || isVideo || isAudio) {
        setItems((prev) => [...prev, {
          id: generateId(),
          type: isVideo ? "video" : isImage ? "image" : "audio",
          file,
          preview: URL.createObjectURL(file),
        }]);
      }
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setShowAttachMenu(false);
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item?.preview) {
        URL.revokeObjectURL(item.preview);
      }
      return prev.filter((i) => i.id !== id);
    });
  };

  // Voice recording functions
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setVoicePreview({ blob, url });
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error starting recording:", error);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }, [isRecording]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (voicePreview) {
      URL.revokeObjectURL(voicePreview.url);
    }
    setVoicePreview(null);
    setRecordingTime(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, [isRecording, voicePreview]);

  const addVoiceToStack = useCallback(() => {
    if (voicePreview) {
      const file = new File([voicePreview.blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
      setItems((prev) => [...prev, {
        id: generateId(),
        type: "voice",
        file,
        preview: voicePreview.url,
        duration: recordingTime,
      }]);
      setVoicePreview(null);
      setRecordingTime(0);
    }
  }, [voicePreview, recordingTime]);

  const togglePreviewPlayback = useCallback(() => {
    if (!audioPreviewRef.current || !voicePreview) return;
    
    if (isPlayingPreview) {
      audioPreviewRef.current.pause();
    } else {
      audioPreviewRef.current.play();
    }
    setIsPlayingPreview(!isPlayingPreview);
  }, [isPlayingPreview, voicePreview]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSend = () => {
    // Add current text if any
    const allItems = [...items];
    if (textInput.trim()) {
      allItems.push({
        id: generateId(),
        type: "text",
        content: textInput.trim(),
      });
    }

    // Add voice preview if exists
    if (voicePreview) {
      const file = new File([voicePreview.blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
      allItems.push({
        id: generateId(),
        type: "voice",
        file,
        preview: voicePreview.url,
        duration: recordingTime,
      });
      setVoicePreview(null);
      setRecordingTime(0);
    }

    if (allItems.length > 0) {
      onSend(allItems);
      setItems([]);
      setTextInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = items.length > 0 || textInput.trim() || voicePreview;

  return (
    <div className="border-t border-border bg-card">
      {/* Reply preview */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-border"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-muted/50">
              <div className="w-1 h-8 bg-primary rounded-full" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">
                  Replying to <span className="font-medium">{replyTo.senderName}</span>
                </p>
                <p className="text-sm truncate">{replyTo.preview}</p>
              </div>
              <button
                onClick={onCancelReply}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice recording UI */}
      <AnimatePresence>
        {(isRecording || voicePreview) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-border"
          >
            {isRecording ? (
              <div className="flex items-center gap-3 px-4 py-3 bg-destructive/5">
                <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
                <span className="text-sm font-mono text-destructive flex-1">{formatTime(recordingTime)}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="p-2 rounded-full bg-destructive text-destructive-foreground"
                  >
                    <Square className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="p-2 rounded-full hover:bg-destructive/10 text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : voicePreview ? (
              <div className="flex items-center gap-3 px-4 py-3 bg-muted/30">
                <button
                  type="button"
                  onClick={togglePreviewPlayback}
                  className="p-2 rounded-full bg-primary/10 text-primary"
                >
                  {isPlayingPreview ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                
                {/* Waveform visualization */}
                <div className="flex items-center gap-0.5 flex-1 h-8">
                  {Array.from({ length: 30 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-1 rounded-full bg-primary/40"
                      style={{
                        height: `${Math.random() * 100}%`,
                        minHeight: "4px",
                      }}
                    />
                  ))}
                </div>
                
                <span className="text-xs text-muted-foreground">{formatTime(recordingTime)}</span>
                
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={addVoiceToStack}
                    className="text-xs text-primary px-2 py-1 rounded-full bg-primary/10 hover:bg-primary/20"
                  >
                    Add to stack
                  </button>
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="p-1.5 rounded-full hover:bg-muted text-muted-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                
                <audio
                  ref={audioPreviewRef}
                  src={voicePreview.url}
                  onEnded={() => setIsPlayingPreview(false)}
                />
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stack items preview */}
      <AnimatePresence>
        {items.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-border"
          >
            <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-hide">
              {items.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="relative flex-shrink-0"
                >
                  {item.type === "text" ? (
                    <div className="max-w-32 p-2 bg-muted rounded-lg text-sm truncate">
                      {item.content}
                    </div>
                  ) : item.type === "voice" || item.type === "audio" ? (
                    <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Mic className="h-6 w-6 text-primary" />
                    </div>
                  ) : item.preview ? (
                    item.type === "video" ? (
                      <video
                        src={item.preview}
                        className="h-16 w-16 object-cover rounded-lg"
                      />
                    ) : (
                      <img
                        src={item.preview}
                        alt=""
                        className="h-16 w-16 object-cover rounded-lg"
                      />
                    )
                  ) : null}
                  
                  <button
                    onClick={() => removeItem(item.id)}
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  
                  <div className="absolute bottom-0 left-0 right-0 text-[10px] text-center text-muted-foreground bg-background/80 rounded-b-lg">
                    {index + 1}
                  </div>
                </motion.div>
              ))}
              
              <button
                onClick={() => fileInputRef.current?.click()}
                className="h-16 w-16 flex-shrink-0 border-2 border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center hover:border-muted-foreground transition-colors"
              >
                <Plus className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Composer input */}
      <div className="flex items-end gap-2 p-3">
        {/* Attach menu button */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={() => setShowAttachMenu(!showAttachMenu)}
          >
            <Plus className={cn(
              "h-5 w-5 transition-transform",
              showAttachMenu && "rotate-45"
            )} />
          </Button>

          <AnimatePresence>
            {showAttachMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                className="absolute bottom-full left-0 mb-2 bg-card border border-border rounded-2xl shadow-xl p-2 flex gap-2"
              >
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                    setShowAttachMenu(false);
                  }}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-muted transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Image className="h-5 w-5 text-blue-500" />
                  </div>
                  <span className="text-xs">Media</span>
                </button>
                
                <button
                  onClick={() => {
                    onOpenCamera();
                    setShowAttachMenu(false);
                  }}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-muted transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Camera className="h-5 w-5 text-green-500" />
                  </div>
                  <span className="text-xs">Camera</span>
                </button>
                
                <button
                  onClick={() => {
                    onOpenGifPicker();
                    setShowAttachMenu(false);
                  }}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-muted transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <Smile className="h-5 w-5 text-purple-500" />
                  </div>
                  <span className="text-xs">GIF</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Text input */}
        <div className="flex-1 relative">
          <Textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            className="min-h-10 max-h-32 resize-none rounded-2xl pr-10 input-field"
            rows={1}
            disabled={disabled || isRecording}
          />
          
          {textInput.trim() && items.length > 0 && (
            <button
              onClick={addTextItem}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-primary hover:text-primary/80"
              title="Add to stack"
            >
              <Plus className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Voice / Send button */}
        {canSend ? (
          <Button
            onClick={handleSend}
            disabled={disabled}
            className="btn-primary h-10 w-10 rounded-full p-0"
          >
            <Send className="h-5 w-5" />
          </Button>
        ) : isRecording ? (
          <Button
            variant="destructive"
            onClick={stopRecording}
            className="h-10 w-10 rounded-full p-0"
          >
            <Square className="h-5 w-5" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            onClick={startRecording}
            disabled={disabled}
            className="h-10 w-10 rounded-full p-0"
          >
            <Mic className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Hidden file input - accepts images, videos, and audio */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
};
