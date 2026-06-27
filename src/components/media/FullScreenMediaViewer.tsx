import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Heart, 
  MessageCircle, 
  Share2, 
  MoreHorizontal, 
  Volume2, 
  VolumeX,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ImageOff
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/common/Avatar';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface MediaItem {
  id: string;
  type: 'image' | 'video' | 'audio';
  url: string;
  caption?: string | null;
  user?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
  createdAt?: string;
  likesCount?: number;
  commentsCount?: number;
  isLiked?: boolean;
  postId?: string;
}

interface FullScreenMediaViewerProps {
  media: MediaItem | null;
  isOpen: boolean;
  onClose: () => void;
  onLike?: (mediaId: string) => void;
  onComment?: (mediaId: string) => void;
  onShare?: (mediaId: string) => void;
  onMore?: (mediaId: string) => void;
  showControls?: boolean;
}

export const FullScreenMediaViewer = ({
  media,
  isOpen,
  onClose,
  onLike,
  onComment,
  onShare,
  onMore,
  showControls = true,
}: FullScreenMediaViewerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(media?.isLiked ?? false);
  const [likesCount, setLikesCount] = useState(media?.likesCount ?? 0);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showControls_state, setShowControlsState] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hideControlsTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Reset state when media changes
  useEffect(() => {
    if (media) {
      setIsLiked(media.isLiked ?? false);
      setLikesCount(media.likesCount ?? 0);
      setIsLoading(true);
      setHasError(false);
      setIsPlaying(false);
    }
  }, [media?.id]);

  // Auto-hide controls
  useEffect(() => {
    if (showControls_state && media?.type === 'video') {
      hideControlsTimeout.current = setTimeout(() => {
        setShowControlsState(false);
      }, 3000);
    }
    return () => {
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
    };
  }, [showControls_state, media?.type]);

  const handleTap = () => {
    setShowControlsState(true);
  };

  const handleDoubleTap = () => {
    if (!isLiked) {
      handleLike();
    }
    setIsLikeAnimating(true);
    setTimeout(() => setIsLikeAnimating(false), 800);
  };

  const handleLike = async () => {
    if (!user || !media?.postId) return;

    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    setLikesCount(prev => newLikedState ? prev + 1 : prev - 1);

    try {
      if (newLikedState) {
        await supabase.from('likes').insert({
          user_id: user.id,
          post_id: media.postId,
        });

        if (media.user?.id && media.user.id !== user.id) {
          await supabase.from('notifications').insert({
            receiver_id: media.user.id,
            actor_id: user.id,
            type: 'like',
            target_id: media.postId,
          });
        }
      } else {
        await supabase
          .from('likes')
          .delete()
          .eq('user_id', user.id)
          .eq('post_id', media.postId);
      }
      onLike?.(media.id);
    } catch (error) {
      // Revert on error
      setIsLiked(!newLikedState);
      setLikesCount(prev => newLikedState ? prev - 1 : prev + 1);
      toast({
        title: 'Error',
        description: 'Failed to update like',
        variant: 'destructive',
      });
    }
  };

  const togglePlayPause = () => {
    if (media?.type === 'video' && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    } else if (media?.type === 'audio' && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleMediaLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleMediaError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const doubleTapRef = useRef<number>(0);
  const handleContentClick = () => {
    const now = Date.now();
    if (now - doubleTapRef.current < 300) {
      handleDoubleTap();
    } else {
      handleTap();
    }
    doubleTapRef.current = now;
  };

  if (!media) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black"
          onClick={handleContentClick}
        >
          {/* Close button */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: showControls_state ? 1 : 0 }}
            className="absolute top-4 left-4 z-50 p-2 rounded-full bg-black/50 backdrop-blur-sm text-white"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            <X className="h-6 w-6" />
          </motion.button>

          {/* User info - top */}
          {media.user && showControls_state && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-16 right-4 z-50 flex items-center gap-3"
            >
              <UserAvatar
                src={media.user.avatar_url}
                fallback={media.user.username}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">
                  {media.user.username}
                </p>
                {media.createdAt && (
                  <p className="text-white/60 text-xs">
                    {formatDistanceToNow(new Date(media.createdAt), { addSuffix: true })}
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* Media content */}
          <div className="absolute inset-0 flex items-center justify-center">
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

            {media.type === 'image' && (
              <img
                src={media.url}
                alt={media.caption || 'Media'}
                className="max-w-full max-h-full object-contain"
                onLoad={handleMediaLoad}
                onError={handleMediaError}
                style={{ display: hasError ? 'none' : 'block' }}
              />
            )}

            {media.type === 'video' && (
              <div className="relative w-full h-full flex items-center justify-center">
                <video
                  ref={videoRef}
                  src={media.url}
                  className="max-w-full max-h-full object-contain"
                  muted={isMuted}
                  playsInline
                  loop
                  onLoadedData={handleMediaLoad}
                  onError={handleMediaError}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  style={{ display: hasError ? 'none' : 'block' }}
                />
                
                {/* Video play/pause overlay */}
                {!isPlaying && !isLoading && !hasError && (
                  <button
                    className="absolute inset-0 flex items-center justify-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlayPause();
                    }}
                  >
                    <div className="p-4 rounded-full bg-black/50 backdrop-blur-sm">
                      <Play className="h-12 w-12 text-white" />
                    </div>
                  </button>
                )}

                {/* Mute button */}
                {showControls_state && (
                  <button
                    className="absolute bottom-24 right-4 p-3 rounded-full bg-black/50 backdrop-blur-sm text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMuted(!isMuted);
                    }}
                  >
                    {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </button>
                )}
              </div>
            )}

            {media.type === 'audio' && (
              <div className="flex flex-col items-center justify-center gap-6 p-8">
                <div className="w-48 h-48 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlayPause();
                    }}
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
                  src={media.url}
                  onLoadedData={handleMediaLoad}
                  onError={handleMediaError}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
              </div>
            )}

            {/* Double tap heart animation */}
            <AnimatePresence>
              {isLikeAnimating && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1.2, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                >
                  <Heart className="h-32 w-32 fill-white text-white drop-shadow-2xl" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom controls */}
          {showControls && showControls_state && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-0 left-0 right-0 z-50 p-4 pb-8 bg-gradient-to-t from-black/80 to-transparent"
            >
              {/* Caption */}
              {media.caption && (
                <p className="text-white text-sm mb-4 line-clamp-2">
                  {media.caption}
                </p>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-around">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  className="flex flex-col items-center gap-1 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLike();
                  }}
                >
                  <Heart
                    className={cn(
                      "h-7 w-7 transition-colors",
                      isLiked ? "fill-red-500 text-red-500" : "text-white"
                    )}
                  />
                  {likesCount > 0 && (
                    <span className="text-xs">{likesCount}</span>
                  )}
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.9 }}
                  className="flex flex-col items-center gap-1 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    onComment?.(media.id);
                  }}
                >
                  <MessageCircle className="h-7 w-7" />
                  {media.commentsCount && media.commentsCount > 0 && (
                    <span className="text-xs">{media.commentsCount}</span>
                  )}
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.9 }}
                  className="text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShare?.(media.id);
                  }}
                >
                  <Share2 className="h-7 w-7" />
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.9 }}
                  className="text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMore?.(media.id);
                  }}
                >
                  <MoreHorizontal className="h-7 w-7" />
                </motion.button>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
