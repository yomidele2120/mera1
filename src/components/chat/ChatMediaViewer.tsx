import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { 
  X, 
  Volume2, 
  VolumeX,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ImageOff,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MediaItem {
  type: 'image' | 'video' | 'audio';
  url: string;
}

interface ChatMediaViewerProps {
  media: MediaItem[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

export const ChatMediaViewer = ({
  media,
  initialIndex = 0,
  isOpen,
  onClose,
}: ChatMediaViewerProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentMedia = media[currentIndex];

  // Reset state when media changes
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    setIsPlaying(false);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  // Reset index when opened
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
    }
  }, [isOpen, initialIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          navigatePrev();
          break;
        case 'ArrowRight':
          navigateNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, media.length]);

  const navigateNext = useCallback(() => {
    if (currentIndex < media.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, media.length]);

  const navigatePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const handleDragEnd = useCallback((e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (scale > 1) return; // Don't navigate when zoomed
    
    if (info.offset.y > 100) {
      onClose();
    } else if (info.offset.x > 100) {
      navigatePrev();
    } else if (info.offset.x < -100) {
      navigateNext();
    }
  }, [scale, navigatePrev, navigateNext, onClose]);

  const togglePlayPause = useCallback(() => {
    if (currentMedia?.type === 'video' && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    } else if (currentMedia?.type === 'audio' && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
  }, [currentMedia, isPlaying]);

  const handleMediaLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  const handleMediaError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + 0.5, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => {
      const newScale = Math.max(prev - 0.5, 1);
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 });
      }
      return newScale;
    });
  }, []);

  const handleDoubleTap = useCallback(() => {
    if (scale > 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      setScale(2);
    }
  }, [scale]);

  if (!currentMedia) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black"
          onClick={(e) => {
            if (e.target === containerRef.current) {
              onClose();
            }
          }}
        >
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4">
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-black/50 backdrop-blur-sm text-white"
            >
              <X className="h-6 w-6" />
            </button>

            {/* Page indicator */}
            {media.length > 1 && (
              <span className="text-white text-sm bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">
                {currentIndex + 1} / {media.length}
              </span>
            )}

            {/* Zoom controls for images */}
            {currentMedia.type === 'image' && (
              <div className="flex gap-2">
                <button
                  onClick={handleZoomOut}
                  disabled={scale === 1}
                  className="p-2 rounded-full bg-black/50 backdrop-blur-sm text-white disabled:opacity-50"
                >
                  <ZoomOut className="h-5 w-5" />
                </button>
                <button
                  onClick={handleZoomIn}
                  disabled={scale >= 3}
                  className="p-2 rounded-full bg-black/50 backdrop-blur-sm text-white disabled:opacity-50"
                >
                  <ZoomIn className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>

          {/* Navigation arrows (desktop) */}
          {media.length > 1 && (
            <>
              {currentIndex > 0 && (
                <button
                  onClick={navigatePrev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-50 p-3 rounded-full bg-black/50 backdrop-blur-sm text-white hidden md:block"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
              )}
              {currentIndex < media.length - 1 && (
                <button
                  onClick={navigateNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-50 p-3 rounded-full bg-black/50 backdrop-blur-sm text-white hidden md:block"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              )}
            </>
          )}

          {/* Media content */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            drag={scale === 1}
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
          >
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-white/50" />
              </div>
            )}

            {hasError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white/50">
                <ImageOff className="h-16 w-16" />
                <p className="text-sm">Failed to load media</p>
              </div>
            )}

            {currentMedia.type === 'image' && (
              <motion.img
                src={currentMedia.url}
                alt="Chat media"
                className="max-w-full max-h-full object-contain select-none"
                style={{ 
                  scale,
                  x: position.x,
                  y: position.y,
                  display: hasError ? 'none' : 'block'
                }}
                drag={scale > 1}
                dragConstraints={{ left: -200, right: 200, top: -200, bottom: 200 }}
                onLoad={handleMediaLoad}
                onError={handleMediaError}
                onDoubleClick={handleDoubleTap}
              />
            )}

            {currentMedia.type === 'video' && (
              <div className="relative w-full h-full flex items-center justify-center">
                <video
                  ref={videoRef}
                  src={currentMedia.url}
                  className="max-w-full max-h-full object-contain"
                  muted={isMuted}
                  playsInline
                  loop
                  controls
                  onLoadedData={handleMediaLoad}
                  onError={handleMediaError}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  style={{ display: hasError ? 'none' : 'block' }}
                />
                
                {/* Mute button */}
                <button
                  className="absolute bottom-20 right-4 p-3 rounded-full bg-black/50 backdrop-blur-sm text-white"
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </button>
              </div>
            )}

            {currentMedia.type === 'audio' && (
              <div className="flex flex-col items-center justify-center gap-6 p-8">
                <div className="w-48 h-48 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center">
                  <button
                    onClick={togglePlayPause}
                    className="p-6 rounded-full bg-white/20 backdrop-blur-sm"
                  >
                    {isPlaying ? (
                      <Pause className="h-12 w-12 text-white" />
                    ) : (
                      <Play className="h-12 w-12 text-white ml-1" />
                    )}
                  </button>
                </div>
                <audio
                  ref={audioRef}
                  src={currentMedia.url}
                  onLoadedData={handleMediaLoad}
                  onError={handleMediaError}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  controls
                  className="w-full max-w-sm"
                />
              </div>
            )}
          </motion.div>

          {/* Dot indicators for multiple media */}
          {media.length > 1 && (
            <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2">
              {media.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    index === currentIndex
                      ? "bg-white w-4"
                      : "bg-white/50"
                  )}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
