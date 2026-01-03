import { useState, useRef } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

interface PostContentProps {
  postType: string;
  mediaUrl: string | null;
  textContent: string | null;
  caption: string | null;
  onDoubleTap?: () => void;
  children?: React.ReactNode;
}

export const PostContent = ({
  postType,
  mediaUrl,
  textContent,
  caption,
  onDoubleTap,
  children,
}: PostContentProps) => {
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

  // Text-only post
  if (postType === "text" || (!mediaUrl && textContent)) {
    return (
      <div className="px-4 py-6 bg-gradient-to-br from-primary/10 to-secondary/10 min-h-32">
        <p className="text-lg whitespace-pre-wrap">{textContent || caption}</p>
      </div>
    );
  }

  // Image post
  if (postType === "image" && mediaUrl) {
    return (
      <div className="relative cursor-pointer bg-muted" onClick={onDoubleTap}>
        <img
          src={mediaUrl}
          alt={caption || "Post image"}
          className="w-full object-contain max-h-[600px]"
          loading="lazy"
        />
        {children}
      </div>
    );
  }

  // Video post
  if (postType === "video" && mediaUrl) {
    return (
      <div className="relative bg-black">
        <video
          ref={videoRef}
          src={mediaUrl}
          className="w-full object-contain max-h-[600px]"
          muted={isMuted}
          playsInline
          controls
          loop
        />
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="absolute bottom-4 right-4 p-2 rounded-full bg-background/80 backdrop-blur-sm"
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        {children}
      </div>
    );
  }

  // Audio post
  if (postType === "audio" && mediaUrl) {
    return (
      <div className="p-6 bg-gradient-to-br from-primary/10 to-secondary/10">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleAudio}
            className="h-14 w-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground"
          >
            {isPlaying ? (
              <Pause className="h-6 w-6" />
            ) : (
              <Play className="h-6 w-6 ml-1" />
            )}
          </button>
          <div className="flex-1">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
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
        {children}
      </div>
    );
  }

  // Fallback: try to detect type from URL
  if (mediaUrl) {
    const extension = mediaUrl.split('.').pop()?.toLowerCase();
    
    if (['mp4', 'mov', 'webm'].includes(extension || '')) {
      return (
        <div className="relative bg-black" onClick={onDoubleTap}>
          <video
            src={mediaUrl}
            className="w-full object-contain max-h-[600px]"
            controls
            muted
            playsInline
          />
          {children}
        </div>
      );
    }
    
    if (['mp3', 'wav', 'm4a', 'ogg', 'webm'].includes(extension || '')) {
      return (
        <div className="p-6 bg-gradient-to-br from-primary/10 to-secondary/10">
          <audio src={mediaUrl} controls className="w-full" />
          {children}
        </div>
      );
    }
    
    // Default to image
    return (
      <div className="relative cursor-pointer bg-muted" onClick={onDoubleTap}>
        <img
          src={mediaUrl}
          alt={caption || "Post"}
          className="w-full object-contain max-h-[600px]"
          loading="lazy"
        />
        {children}
      </div>
    );
  }

  return null;
};
