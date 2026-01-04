import { cn } from "@/lib/utils";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { useState, useRef } from "react";

interface MessageContentProps {
  messageType: string;
  mediaUrl: string | null;
  text: string | null;
  isOwn: boolean;
}

export const MessageContent = ({ messageType, mediaUrl, text, isOwn }: MessageContentProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [audioProgress, setAudioProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setAudioProgress(progress);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setAudioProgress(0);
  };

  // Text message
  if (messageType === "text" || (!mediaUrl && text)) {
    return <p className="text-sm whitespace-pre-wrap">{text}</p>;
  }

  // GIF message
  if (messageType === "gif" && mediaUrl) {
    return (
      <div className="space-y-2">
        <img
          src={mediaUrl}
          alt="GIF"
          className="rounded-lg max-w-full object-contain max-h-48"
          loading="lazy"
        />
        {text && <p className="text-sm whitespace-pre-wrap">{text}</p>}
      </div>
    );
  }

  // Sticker message
  if (messageType === "sticker" && mediaUrl) {
    return (
      <div className="space-y-2">
        <img
          src={mediaUrl}
          alt="Sticker"
          className="max-w-24 max-h-24 object-contain"
          loading="lazy"
        />
        {text && <p className="text-sm whitespace-pre-wrap">{text}</p>}
      </div>
    );
  }

  // Image message
  if (messageType === "image" && mediaUrl) {
    return (
      <div className="space-y-2">
        <img
          src={mediaUrl}
          alt="Shared image"
          className="rounded-lg max-w-full object-contain max-h-64"
          loading="lazy"
        />
        {text && <p className="text-sm whitespace-pre-wrap">{text}</p>}
      </div>
    );
  }

  // Video message
  if (messageType === "video" && mediaUrl) {
    return (
      <div className="space-y-2">
        <div className="relative rounded-lg overflow-hidden max-w-full">
          <video
            ref={videoRef}
            src={mediaUrl}
            className="max-w-full max-h-64 object-contain"
            muted={isMuted}
            playsInline
            controls
          />
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="absolute bottom-2 right-2 p-1.5 rounded-full bg-background/80 backdrop-blur-sm"
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
        {text && <p className="text-sm whitespace-pre-wrap">{text}</p>}
      </div>
    );
  }

  // Audio message
  if (messageType === "audio" && mediaUrl) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3 min-w-48">
          <button
            onClick={toggleAudio}
            className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center transition-colors",
              isOwn ? "bg-primary-foreground/20" : "bg-primary/20"
            )}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4 ml-0.5" />
            )}
          </button>
          <div className="flex-1">
            <div className="h-1 bg-muted-foreground/30 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  isOwn ? "bg-primary-foreground" : "bg-primary"
                )}
                style={{ width: `${audioProgress}%` }}
              />
            </div>
          </div>
          <audio
            ref={audioRef}
            src={mediaUrl}
            onTimeUpdate={handleAudioTimeUpdate}
            onEnded={handleAudioEnded}
          />
        </div>
        {text && <p className="text-sm whitespace-pre-wrap mt-2">{text}</p>}
      </div>
    );
  }

  // Fallback for media_url without type
  if (mediaUrl) {
    const extension = mediaUrl.split('.').pop()?.toLowerCase();
    
    if (['mp4', 'mov', 'webm'].includes(extension || '')) {
      return (
        <div className="space-y-2">
          <video
            src={mediaUrl}
            className="rounded-lg max-w-full max-h-64 object-contain"
            controls
            muted
            playsInline
          />
          {text && <p className="text-sm whitespace-pre-wrap">{text}</p>}
        </div>
      );
    }
    
    if (['mp3', 'wav', 'm4a', 'ogg'].includes(extension || '')) {
      return (
        <div className="space-y-2">
          <audio src={mediaUrl} controls className="max-w-full" />
          {text && <p className="text-sm whitespace-pre-wrap">{text}</p>}
        </div>
      );
    }
    
    // Default to image
    return (
      <div className="space-y-2">
        <img
          src={mediaUrl}
          alt="Shared media"
          className="rounded-lg max-w-full object-contain max-h-64"
          loading="lazy"
        />
        {text && <p className="text-sm whitespace-pre-wrap">{text}</p>}
      </div>
    );
  }

  return text ? <p className="text-sm whitespace-pre-wrap">{text}</p> : null;
};
