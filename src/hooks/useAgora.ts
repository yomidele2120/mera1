import { useState, useEffect, useCallback, useRef } from 'react';
import AgoraRTC, {
  IAgoraRTCClient,
  IMicrophoneAudioTrack,
  ICameraVideoTrack,
  IAgoraRTCRemoteUser,
} from 'agora-rtc-sdk-ng';
import { supabase } from '@/integrations/supabase/client';

interface UseAgoraProps {
  channelName: string;
  isVideoCall: boolean;
  onUserJoined?: (user: IAgoraRTCRemoteUser) => void;
  onUserLeft?: (user: IAgoraRTCRemoteUser) => void;
  onConnectionStateChange?: (state: string) => void;
}

interface UseAgoraReturn {
  joinChannel: () => Promise<boolean>;
  leaveChannel: () => Promise<void>;
  toggleMute: () => void;
  toggleVideo: () => void;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isJoined: boolean;
  isConnecting: boolean;
  error: string | null;
  localVideoRef: React.RefObject<HTMLDivElement>;
  remoteVideoRef: React.RefObject<HTMLDivElement>;
  remoteUser: IAgoraRTCRemoteUser | null;
}

export const useAgora = ({
  channelName,
  isVideoCall,
  onUserJoined,
  onUserLeft,
  onConnectionStateChange,
}: UseAgoraProps): UseAgoraReturn => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(isVideoCall);
  const [isJoined, setIsJoined] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remoteUser, setRemoteUser] = useState<IAgoraRTCRemoteUser | null>(null);

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const localVideoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);

  // Initialize Agora client
  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = AgoraRTC.createClient({ 
        mode: 'rtc', 
        codec: 'vp8' 
      });
    }

    const client = clientRef.current;

    // Handle user published
    const handleUserPublished = async (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
      await client.subscribe(user, mediaType);
      console.log(`Subscribed to ${user.uid} ${mediaType}`);

      if (mediaType === 'video' && remoteVideoRef.current) {
        user.videoTrack?.play(remoteVideoRef.current);
      }
      if (mediaType === 'audio') {
        user.audioTrack?.play();
      }
      
      setRemoteUser(user);
      onUserJoined?.(user);
    };

    // Handle user unpublished
    const handleUserUnpublished = (user: IAgoraRTCRemoteUser) => {
      console.log(`User ${user.uid} unpublished`);
    };

    // Handle user left
    const handleUserLeft = (user: IAgoraRTCRemoteUser) => {
      console.log(`User ${user.uid} left`);
      setRemoteUser(null);
      onUserLeft?.(user);
    };

    // Handle connection state change
    const handleConnectionStateChange = (curState: string) => {
      console.log('Connection state:', curState);
      onConnectionStateChange?.(curState);
    };

    client.on('user-published', handleUserPublished);
    client.on('user-unpublished', handleUserUnpublished);
    client.on('user-left', handleUserLeft);
    client.on('connection-state-change', handleConnectionStateChange);

    return () => {
      client.off('user-published', handleUserPublished);
      client.off('user-unpublished', handleUserUnpublished);
      client.off('user-left', handleUserLeft);
      client.off('connection-state-change', handleConnectionStateChange);
    };
  }, [onUserJoined, onUserLeft, onConnectionStateChange]);

  // Get Agora credentials from edge function
  const getAgoraCredentials = async (channel: string): Promise<{ appId: string; token?: string; uid?: number; mode?: string } | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('agora-credentials', {
        body: { channelName: channel, uid: null }
      });
      
      if (error) {
        console.error('Error fetching Agora credentials:', error);
        return null;
      }
      
      console.log('Agora credentials received, mode:', data?.mode);
      return data;
    } catch (err) {
      console.error('Failed to get Agora credentials:', err);
      return null;
    }
  };

  // Join channel
  const joinChannel = useCallback(async (): Promise<boolean> => {
    if (!clientRef.current || !channelName) {
      setError('Agora client not initialized or channel name missing');
      return false;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Get Agora credentials from backend with channel name
      const credentials = await getAgoraCredentials(channelName);
      
      if (!credentials?.appId) {
        setError('Agora is not configured. Please contact support.');
        setIsConnecting(false);
        return false;
      }

      console.log('Joining channel with mode:', credentials.mode);

      // Request microphone permission
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStream.getTracks().forEach(track => track.stop());

      // Request camera permission for video calls
      if (isVideoCall) {
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
          videoStream.getTracks().forEach(track => track.stop());
        } catch (videoErr) {
          console.warn('Camera permission denied, continuing with audio only');
          setIsVideoEnabled(false);
        }
      }

      // Join the channel with token and UID from server
      await clientRef.current.join(
        credentials.appId, 
        channelName, 
        credentials.token || null, 
        credentials.uid || null
      );

      // Create local tracks
      localAudioTrackRef.current = await AgoraRTC.createMicrophoneAudioTrack();

      if (isVideoCall && isVideoEnabled) {
        try {
          localVideoTrackRef.current = await AgoraRTC.createCameraVideoTrack();
          if (localVideoRef.current) {
            localVideoTrackRef.current.play(localVideoRef.current);
          }
        } catch (videoErr) {
          console.warn('Failed to create video track:', videoErr);
        }
      }

      // Publish tracks
      const tracksToPublish: (IMicrophoneAudioTrack | ICameraVideoTrack)[] = [];
      if (localAudioTrackRef.current) tracksToPublish.push(localAudioTrackRef.current);
      if (localVideoTrackRef.current) tracksToPublish.push(localVideoTrackRef.current);

      await clientRef.current.publish(tracksToPublish);

      setIsJoined(true);
      setIsConnecting(false);
      console.log('Successfully joined channel:', channelName);
      return true;
    } catch (err: any) {
      console.error('Error joining channel:', err);
      setError(err.message || 'Failed to join call');
      setIsConnecting(false);
      return false;
    }
  }, [channelName, isVideoCall, isVideoEnabled]);

  // Leave channel
  const leaveChannel = useCallback(async () => {
    try {
      // Stop and close local tracks
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop();
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
      }

      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.stop();
        localVideoTrackRef.current.close();
        localVideoTrackRef.current = null;
      }

      // Leave the channel
      if (clientRef.current) {
        await clientRef.current.leave();
      }

      setIsJoined(false);
      setRemoteUser(null);
      console.log('Left channel successfully');
    } catch (err) {
      console.error('Error leaving channel:', err);
    }
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localAudioTrackRef.current) {
      const newMutedState = !isMuted;
      localAudioTrackRef.current.setEnabled(!newMutedState);
      setIsMuted(newMutedState);
    }
  }, [isMuted]);

  // Toggle video
  const toggleVideo = useCallback(async () => {
    if (!isVideoCall) return;

    if (isVideoEnabled && localVideoTrackRef.current) {
      localVideoTrackRef.current.setEnabled(false);
      setIsVideoEnabled(false);
    } else {
      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.setEnabled(true);
      } else {
        try {
          localVideoTrackRef.current = await AgoraRTC.createCameraVideoTrack();
          if (clientRef.current && isJoined) {
            await clientRef.current.publish(localVideoTrackRef.current);
          }
          if (localVideoRef.current) {
            localVideoTrackRef.current.play(localVideoRef.current);
          }
        } catch (err) {
          console.error('Error enabling video:', err);
          return;
        }
      }
      setIsVideoEnabled(true);
    }
  }, [isVideoCall, isVideoEnabled, isJoined]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      leaveChannel();
    };
  }, [leaveChannel]);

  return {
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
  };
};
