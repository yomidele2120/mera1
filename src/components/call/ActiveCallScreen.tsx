import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff,
  Volume2,
  VolumeX
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/common/Avatar";
import { UserNumber } from "@/components/user/UserNumber";
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
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(call.call_type === 'video');
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const jitsiApiRef = useRef<any>(null);

  const otherUser = call.caller_id === currentUserId ? call.receiver : call.caller;
  const isVideoCall = call.call_type === 'video';

  // Initialize Jitsi
  useEffect(() => {
    const loadJitsi = async () => {
      // Load Jitsi external API script
      const script = document.createElement('script');
      script.src = 'https://meet.jit.si/external_api.js';
      script.async = true;
      script.onload = () => {
        if (jitsiContainerRef.current && (window as any).JitsiMeetExternalAPI) {
          const domain = 'meet.jit.si';
          const options = {
            roomName: call.room_name,
            parentNode: jitsiContainerRef.current,
            width: '100%',
            height: '100%',
            configOverwrite: {
              startWithAudioMuted: false,
              startWithVideoMuted: !isVideoCall,
              prejoinPageEnabled: false,
              disableDeepLinking: true,
              enableClosePage: false,
              hideConferenceSubject: true,
              hideConferenceTimer: true,
              disableInviteFunctions: true,
            },
            interfaceConfigOverwrite: {
              TOOLBAR_BUTTONS: [],
              SHOW_JITSI_WATERMARK: false,
              SHOW_WATERMARK_FOR_GUESTS: false,
              SHOW_BRAND_WATERMARK: false,
              SHOW_POWERED_BY: false,
              SHOW_PROMOTIONAL_CLOSE_PAGE: false,
              filmStripOnly: false,
              DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
            },
            userInfo: {
              displayName: otherUser?.username || 'User',
            }
          };

          jitsiApiRef.current = new (window as any).JitsiMeetExternalAPI(domain, options);

          jitsiApiRef.current.addListener('readyToClose', () => {
            onEnd();
          });
        }
      };
      document.body.appendChild(script);

      return () => {
        if (jitsiApiRef.current) {
          jitsiApiRef.current.dispose();
        }
        document.body.removeChild(script);
      };
    };

    loadJitsi();
  }, [call.room_name, isVideoCall, otherUser?.username, onEnd]);

  // Handle mute toggle
  const toggleMute = () => {
    if (jitsiApiRef.current) {
      jitsiApiRef.current.executeCommand('toggleAudio');
    }
    setIsMuted(!isMuted);
  };

  // Handle video toggle
  const toggleVideo = () => {
    if (jitsiApiRef.current) {
      jitsiApiRef.current.executeCommand('toggleVideo');
    }
    setIsVideoOn(!isVideoOn);
  };

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

      {/* Jitsi Container or Audio Call Display */}
      <div className="flex-1 relative">
        {isVideoCall ? (
          <div ref={jitsiContainerRef} className="w-full h-full" />
        ) : (
          <div className="flex-1 flex items-center justify-center">
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
                <p className="text-muted-foreground">Voice Call</p>
              </div>
              {/* Hidden Jitsi for audio */}
              <div ref={jitsiContainerRef} className="w-0 h-0 overflow-hidden" />
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
              variant={!isVideoOn ? "secondary" : "outline"}
              size="lg"
              className="h-14 w-14 rounded-full"
              onClick={toggleVideo}
            >
              {isVideoOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
            </Button>
          )}

          <Button
            variant="destructive"
            size="lg"
            className="h-16 w-16 rounded-full"
            onClick={onEnd}
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
