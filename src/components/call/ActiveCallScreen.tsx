import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff,
  Volume2,
  VolumeX,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/common/Avatar";
import { UserNumber } from "@/components/user/UserNumber";
import { useAgora } from "@/hooks/useAgora";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import type { CallLog } from "@/hooks/useCalling";

interface ActiveCallScreenProps {
  call: CallLog;
  currentUserId: string;
  duration: string;
  onEnd: () => void;
}

export const ActiveCallScreen = ({ 
  call, 
  currentUserId, 
  duration, 
  onEnd 
}: ActiveCallScreenProps) => {
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);

  const otherUser = call.caller_id === currentUserId ? call.receiver : call.caller;
  const isVideoCall = call.call_type === 'video';

  const {
    joinChannel,
    leaveChannel,
    toggleMute,
    toggleVideo,
    isMuted,
    isVideoEnabled,
    isJoined,
    isConnecting,
    error,
    localVideoRef,
    remoteVideoRef,
    remoteUser,
  } = useAgora({
    channelName: call.room_name,
    isVideoCall,
    onUserLeft: () => {
      console.log('Remote user left, ending call');
      handleEndCall();
    },
  });

  // Join channel on mount
  useEffect(() => {
    if (!hasJoined) {
      setHasJoined(true);
      joinChannel();
    }
  }, [hasJoined, joinChannel]);

  const handleEndCall = async () => {
    await leaveChannel();
    onEnd();
  };

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background"
      >
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Call Error</h3>
        <p className="text-muted-foreground text-center px-4 mb-6">{error}</p>
        <Button variant="outline" onClick={onEnd}>
          Close
        </Button>
      </motion.div>
    );
  }

  if (isConnecting) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background"
      >
        <LoadingSpinner size="lg" />
        <p className="text-muted-foreground mt-4">Connecting to call...</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-card border-b border-border">
        <div className="flex items-center gap-3">
          <UserAvatar
            src={otherUser?.avatar_url}
            fallback={otherUser?.username || 'U'}
            size="md"
          />
          <div>
            <h3 className="font-semibold text-foreground">{otherUser?.username}</h3>
            {otherUser?.user_number && (
              <UserNumber userNumber={otherUser.user_number} showCopyButton={false} className="text-xs" />
            )}
          </div>
        </div>
        <div className="text-lg font-mono text-foreground">{duration}</div>
      </div>

      {/* Video/Audio Display */}
      <div className="flex-1 relative bg-muted">
        {isVideoCall ? (
          <>
            {/* Remote Video (full screen) */}
            <div 
              ref={remoteVideoRef} 
              className="absolute inset-0 bg-background"
            />
            
            {/* Local Video (picture-in-picture) */}
            <div 
              ref={localVideoRef} 
              className="absolute top-4 right-4 w-32 h-44 rounded-xl overflow-hidden bg-card shadow-lg border border-border"
            />

            {/* No remote user placeholder */}
            {!remoteUser && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <UserAvatar
                      src={otherUser?.avatar_url}
                      fallback={otherUser?.username || 'U'}
                      size="xl"
                      className="h-32 w-32 mx-auto border-4 border-primary"
                    />
                  </motion.div>
                  <p className="text-muted-foreground mt-4">Waiting for {otherUser?.username}...</p>
                </div>
              </div>
            )}
          </>
        ) : (
          // Audio call display
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <UserAvatar
                  src={otherUser?.avatar_url}
                  fallback={otherUser?.username || 'U'}
                  size="xl"
                  className="h-40 w-40 mx-auto border-4 border-primary"
                />
              </motion.div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">{otherUser?.username}</h2>
                <p className="text-muted-foreground">
                  {remoteUser ? 'Voice Call' : `Waiting for ${otherUser?.username}...`}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Call Controls */}
      <div className="p-6 bg-card border-t border-border">
        <div className="flex items-center justify-center gap-4">
          <Button
            variant={isMuted ? "secondary" : "outline"}
            size="lg"
            className="h-14 w-14 rounded-full"
            onClick={toggleMute}
          >
            {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </Button>

          {isVideoCall && (
            <Button
              variant={!isVideoEnabled ? "secondary" : "outline"}
              size="lg"
              className="h-14 w-14 rounded-full"
              onClick={toggleVideo}
            >
              {isVideoEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
            </Button>
          )}

          <Button
            variant="destructive"
            size="lg"
            className="h-16 w-16 rounded-full"
            onClick={handleEndCall}
          >
            <PhoneOff className="h-6 w-6" />
          </Button>

          <Button
            variant={isSpeakerOn ? "secondary" : "outline"}
            size="lg"
            className="h-14 w-14 rounded-full"
            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
          >
            {isSpeakerOn ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
          </Button>
        </div>
      </div>
    </motion.div>
  );
};
