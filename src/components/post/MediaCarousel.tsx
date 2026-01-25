import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MediaItem {
  url: string;
  type: "image" | "video";
}

interface MediaCarouselProps {
  mediaItems: MediaItem[];
  caption?: string | null;
  onDoubleTap?: () => void;
  children?: React.ReactNode;
}

export const MediaCarousel = ({
  mediaItems,
  caption,
  onDoubleTap,
  children,
}: MediaCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState<Record<number, boolean>>({});
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const handlePrev = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(mediaItems.length - 1, prev + 1));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;

    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;

    if (diff > threshold) {
      handleNext();
    } else if (diff < -threshold) {
      handlePrev();
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  const toggleVideoPlay = (index: number) => {
    const video = videoRefs.current[index];
    if (video) {
      if (video.paused) {
        video.play();
        setIsPlaying((prev) => ({ ...prev, [index]: true }));
      } else {
        video.pause();
        setIsPlaying((prev) => ({ ...prev, [index]: false }));
      }
    }
  };

  const currentItem = mediaItems[currentIndex];

  if (mediaItems.length === 0) return null;

  // Single item - no carousel needed
  if (mediaItems.length === 1) {
    const item = mediaItems[0];
    return (
      <div className="relative bg-muted" onClick={onDoubleTap}>
        {item.type === "video" ? (
          <div className="relative">
            <video
              src={item.url}
              className="w-full object-contain max-h-[500px]"
              muted={isMuted}
              playsInline
              controls
              loop
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMuted(!isMuted);
              }}
              className="absolute bottom-4 right-4 p-2 rounded-full bg-background/80 backdrop-blur-sm"
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
        ) : (
          <img
            src={item.url}
            alt={caption || "Post image"}
            className="w-full object-contain max-h-[500px]"
            loading="lazy"
          />
        )}
        {children}
      </div>
    );
  }

  return (
    <div
      className="relative bg-muted overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Main carousel content */}
      <div className="relative" onClick={onDoubleTap}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full"
          >
            {currentItem.type === "video" ? (
              <div className="relative">
                <video
                  ref={(el) => (videoRefs.current[currentIndex] = el)}
                  src={currentItem.url}
                  className="w-full object-contain max-h-[500px]"
                  muted={isMuted}
                  playsInline
                  loop
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleVideoPlay(currentIndex);
                  }}
                />
                {!isPlaying[currentIndex] && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="h-16 w-16 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center">
                      <Play className="h-8 w-8 text-foreground ml-1" />
                    </div>
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMuted(!isMuted);
                  }}
                  className="absolute bottom-4 right-4 p-2 rounded-full bg-background/80 backdrop-blur-sm"
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
              </div>
            ) : (
              <img
                src={currentItem.url}
                alt={caption || `Image ${currentIndex + 1}`}
                className="w-full object-contain max-h-[500px]"
                loading="lazy"
              />
            )}
          </motion.div>
        </AnimatePresence>
        {children}
      </div>

      {/* Navigation arrows (desktop) */}
      {currentIndex > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePrev();
          }}
          className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors hidden md:flex"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {currentIndex < mediaItems.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors hidden md:flex"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      {/* Dot indicators */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
        {mediaItems.map((_, index) => (
          <button
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex(index);
            }}
            className={cn(
              "h-1.5 rounded-full transition-all",
              index === currentIndex
                ? "w-6 bg-primary"
                : "w-1.5 bg-foreground/40 hover:bg-foreground/60"
            )}
          />
        ))}
      </div>

      {/* Media counter */}
      <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-background/80 backdrop-blur-sm text-xs font-medium">
        {currentIndex + 1}/{mediaItems.length}
      </div>
    </div>
  );
};
