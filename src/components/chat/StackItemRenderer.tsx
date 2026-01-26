import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

interface StackItem {
  id: string;
  item_type: "text" | "image" | "video" | "audio" | "voice" | "gif" | "sticker";
  content: string | null;
  media_url: string | null;
  duration_seconds: number | null;
  sort_order: number;
}

interface StackItemRendererProps {
  item: StackItem;
  isOwn: boolean;
  onLongPress?: () => void;
}

export const StackItemRenderer = ({ item, isOwn, onLongPress }: StackItemRendererProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      onLongPress?.();
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const toggleAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = (ref: HTMLAudioElement | HTMLVideoElement | null) => {
    if (ref) {
      const prog = (ref.currentTime / ref.duration) * 100;
      setProgress(prog);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
  };

  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  const renderContent = () => {
    switch (item.item_type) {
      case "text":
        return (
          <p 
            className="text-sm whitespace-pre-wrap break-words"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleTouchStart}
            onMouseUp={handleTouchEnd}
          >
            {item.content}
          </p>
        );

      case "image":
        return item.media_url ? (
          <div
            className="relative"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleTouchStart}
            onMouseUp={handleTouchEnd}
          >
            <img
              src={item.media_url}
              alt=""
              className="rounded-xl max-w-full max-h-64 object-cover"
              loading="lazy"
            />
          </div>
        ) : null;

      case "video":
        return item.media_url ? (
          <div
            className="relative rounded-xl overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleTouchStart}
            onMouseUp={handleTouchEnd}
          >
            <video
              ref={videoRef}
              src={item.media_url}
              className="max-w-full max-h-64 object-cover"
              muted={isMuted}
              playsInline
              controls
              onTimeUpdate={() => handleTimeUpdate(videoRef.current)}
              onEnded={handleEnded}
            />
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="absolute bottom-2 right-2 p-1.5 rounded-full bg-background/80 backdrop-blur-sm"
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
        ) : null;

      case "audio":
      case "voice":
        return (
          <div
            className="flex items-center gap-3 min-w-48 p-3"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleTouchStart}
            onMouseUp={handleTouchEnd}
          >
            <button
              onClick={toggleAudio}
              className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0",
                isOwn ? "bg-primary-foreground/20" : "bg-primary/20"
              )}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4 ml-0.5" />
              )}
            </button>
            
            <div className="flex-1 space-y-1">
              {/* Waveform visualization */}
              <div className="flex items-center gap-0.5 h-6">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-0.5 rounded-full transition-all",
                      i / 20 * 100 < progress
                        ? isOwn ? "bg-primary-foreground" : "bg-primary"
                        : "bg-muted-foreground/30"
                    )}
                    style={{
                      height: `${Math.random() * 100}%`,
                      minHeight: "4px",
                    }}
                  />
                ))}
              </div>
              
              <div className="text-xs text-muted-foreground">
                {item.duration_seconds
                  ? `${Math.floor(item.duration_seconds / 60)}:${(item.duration_seconds % 60).toString().padStart(2, "0")}`
                  : "Voice message"
                }
              </div>
            </div>
            
            {item.media_url && (
              <audio
                ref={audioRef}
                src={item.media_url}
                onTimeUpdate={() => handleTimeUpdate(audioRef.current)}
                onEnded={handleEnded}
              />
            )}
          </div>
        );

      case "gif":
        return item.media_url ? (
          <img
            src={item.media_url}
            alt="GIF"
            className="rounded-xl max-w-full max-h-48 object-contain"
            loading="lazy"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleTouchStart}
            onMouseUp={handleTouchEnd}
          />
        ) : null;

      case "sticker":
        return item.media_url ? (
          <img
            src={item.media_url}
            alt="Sticker"
            className="max-w-24 max-h-24 object-contain"
            loading="lazy"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleTouchStart}
            onMouseUp={handleTouchEnd}
          />
        ) : null;

      default:
        return item.content ? (
          <p className="text-sm whitespace-pre-wrap">{item.content}</p>
        ) : null;
    }
  };

  return renderContent();
};
