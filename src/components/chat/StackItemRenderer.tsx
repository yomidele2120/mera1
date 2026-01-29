import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { ChatMediaViewer } from "./ChatMediaViewer";

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
  const [showMediaViewer, setShowMediaViewer] = useState(false);
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

  const handleMediaTap = (e: React.MouseEvent) => {
    // Prevent opening viewer on long press
    if (e.detail === 1) {
      const timer = setTimeout(() => {
        if (item.item_type === "image" || item.item_type === "video" || item.item_type === "gif") {
          setShowMediaViewer(true);
        }
      }, 200);
      return () => clearTimeout(timer);
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

  // Get media type for viewer
  const getMediaType = (): "image" | "video" | "audio" => {
    if (item.item_type === "video") return "video";
    if (item.item_type === "audio" || item.item_type === "voice") return "audio";
    return "image";
  };

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
            className="relative cursor-pointer"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleTouchStart}
            onMouseUp={handleTouchEnd}
            onClick={handleMediaTap}
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
            className="relative rounded-xl overflow-hidden cursor-pointer"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleTouchStart}
            onMouseUp={handleTouchEnd}
            onClick={handleMediaTap}
          >
            <video
              ref={videoRef}
              src={item.media_url}
              className="max-w-full max-h-64 object-cover"
              muted={isMuted}
              playsInline
              onTimeUpdate={() => handleTimeUpdate(videoRef.current)}
              onEnded={handleEnded}
            />
            {/* Play overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="p-3 rounded-full bg-black/50 backdrop-blur-sm">
                <Play className="h-6 w-6 text-white" />
              </div>
            </div>
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
            className="rounded-xl max-w-full max-h-48 object-contain cursor-pointer"
            loading="lazy"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleTouchStart}
            onMouseUp={handleTouchEnd}
            onClick={handleMediaTap}
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

  return (
    <>
      {renderContent()}
      
      {/* Full-screen media viewer */}
      {item.media_url && (
        <ChatMediaViewer
          media={[{
            type: getMediaType(),
            url: item.media_url,
          }]}
          isOpen={showMediaViewer}
          onClose={() => setShowMediaViewer(false)}
        />
      )}
    </>
  );
};
