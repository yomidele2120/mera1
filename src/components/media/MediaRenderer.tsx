import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Loader2, 
  ImageOff,
  RefreshCw 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MediaRendererProps {
  url: string | null;
  type?: 'image' | 'video' | 'audio' | 'auto';
  alt?: string;
  className?: string;
  containerClassName?: string;
  aspectRatio?: 'auto' | 'square' | 'video' | 'portrait';
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  onClick?: () => void;
  onLoad?: () => void;
  onError?: () => void;
  showFallback?: boolean;
  fallbackMessage?: string;
}

// Detect media type from URL
const detectMediaType = (url: string): 'image' | 'video' | 'audio' | null => {
  if (!url) return null;
  
  const cleanUrl = url.split('?')[0].toLowerCase();
  const extension = cleanUrl.split('.').pop();
  
  if (!extension) return 'image'; // Default to image
  
  const videoExtensions = ['mp4', 'mov', 'webm', 'avi', 'mkv', 'm4v'];
  const audioExtensions = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'webm', 'flac'];
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
  
  if (videoExtensions.includes(extension)) return 'video';
  if (audioExtensions.includes(extension)) return 'audio';
  if (imageExtensions.includes(extension)) return 'image';
  
  // Default to image for unknown types
  return 'image';
};

export const MediaRenderer = ({
  url,
  type = 'auto',
  alt = 'Media content',
  className,
  containerClassName,
  aspectRatio = 'auto',
  controls = true,
  autoPlay = false,
  muted = true,
  loop = true,
  onClick,
  onLoad,
  onError,
  showFallback = true,
  fallbackMessage = 'Failed to load media',
}: MediaRendererProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(muted);
  const [audioProgress, setAudioProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const retryCount = useRef(0);
  const maxRetries = 2;

  // Reset state when URL changes
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    retryCount.current = 0;
  }, [url]);

  // Detect media type
  const mediaType = type === 'auto' ? detectMediaType(url || '') : type;

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  };

  const handleError = () => {
    if (retryCount.current < maxRetries) {
      retryCount.current++;
      // Force reload with cache bust
      const element = videoRef.current || audioRef.current;
      if (element) {
        const separator = url?.includes('?') ? '&' : '?';
        element.src = `${url}${separator}retry=${retryCount.current}`;
        element.load();
        return;
      }
    }
    setIsLoading(false);
    setHasError(true);
    onError?.();
  };

  const handleRetry = () => {
    retryCount.current = 0;
    setIsLoading(true);
    setHasError(false);
    
    const element = videoRef.current || audioRef.current;
    if (element) {
      element.load();
    }
  };

  const togglePlay = () => {
    if (mediaType === 'video' && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    } else if (mediaType === 'audio' && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setAudioProgress(progress);
    }
  };

  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case 'square': return 'aspect-square';
      case 'video': return 'aspect-video';
      case 'portrait': return 'aspect-[9/16]';
      default: return '';
    }
  };

  if (!url) {
    return showFallback ? (
      <div className={cn(
        "flex items-center justify-center bg-muted rounded-lg p-8",
        getAspectRatioClass(),
        containerClassName
      )}>
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <ImageOff className="h-8 w-8" />
          <p className="text-sm">No media</p>
        </div>
      </div>
    ) : null;
  }

  // Error state
  if (hasError && showFallback) {
    return (
      <div 
        className={cn(
          "flex items-center justify-center bg-muted rounded-lg p-8",
          getAspectRatioClass(),
          containerClassName
        )}
        onClick={onClick}
      >
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <ImageOff className="h-8 w-8" />
          <p className="text-sm text-center">{fallbackMessage}</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRetry();
            }}
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Image
  if (mediaType === 'image') {
    return (
      <div 
        className={cn("relative", getAspectRatioClass(), containerClassName)}
        onClick={onClick}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted rounded-lg">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        <img
          src={url}
          alt={alt}
          className={cn(
            "w-full h-full object-contain transition-opacity duration-300",
            isLoading ? 'opacity-0' : 'opacity-100',
            className
          )}
          loading="lazy"
          onLoad={handleLoad}
          onError={handleError}
        />
      </div>
    );
  }

  // Video
  if (mediaType === 'video') {
    return (
      <div 
        className={cn("relative bg-black rounded-lg overflow-hidden", getAspectRatioClass(), containerClassName)}
        onClick={onClick}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-white/50" />
          </div>
        )}
        <video
          ref={videoRef}
          src={url}
          className={cn(
            "w-full h-full object-contain",
            isLoading ? 'opacity-0' : 'opacity-100',
            className
          )}
          muted={isMuted}
          playsInline
          loop={loop}
          controls={controls}
          autoPlay={autoPlay}
          onLoadedData={handleLoad}
          onError={handleError}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
        
        {/* Mute toggle */}
        {!controls && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMuted(!isMuted);
              if (videoRef.current) {
                videoRef.current.muted = !isMuted;
              }
            }}
            className="absolute bottom-3 right-3 p-2 rounded-full bg-black/50 backdrop-blur-sm text-white"
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        )}
      </div>
    );
  }

  // Audio
  if (mediaType === 'audio') {
    return (
      <div 
        className={cn("p-4 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg", containerClassName)}
        onClick={onClick}
      >
        <div className="flex items-center gap-4">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground flex-shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </motion.button>
          
          <div className="flex-1">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                style={{ width: `${audioProgress}%` }}
              />
            </div>
          </div>
          
          <audio
            ref={audioRef}
            src={url}
            onLoadedData={handleLoad}
            onError={handleError}
            onTimeUpdate={handleAudioTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => {
              setIsPlaying(false);
              setAudioProgress(0);
            }}
          />
        </div>
      </div>
    );
  }

  return null;
};
