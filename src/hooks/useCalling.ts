import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useBlocking } from './useBlocking';

export interface CallLog {
  id: string;
  caller_id: string;
  receiver_id: string;
  room_name: string;
  call_type: 'voice' | 'video';
  status: 'pending' | 'ringing' | 'ongoing' | 'completed' | 'missed' | 'rejected' | 'cancelled';
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at: string;
  caller?: {
    id: string;
    username: string;
    avatar_url: string | null;
    user_number: number | null;
  };
  receiver?: {
    id: string;
    username: string;
    avatar_url: string | null;
    user_number: number | null;
  };
}

interface UseCallingProps {
  otherUserId?: string;
}

export const useCalling = ({ otherUserId }: UseCallingProps = {}) => {
  const { user, profile } = useAuth();
  const [incomingCall, setIncomingCall] = useState<CallLog | null>(null);
  const [activeCall, setActiveCall] = useState<CallLog | null>(null);
  const [callStatus, setCallStatus] = useState<string>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const { isAnyBlocked } = useBlocking(otherUserId);

  // Generate room name
  const generateRoomName = useCallback((callerId: string, receiverId: string) => {
    const timestamp = Date.now();
    return `call_${callerId.slice(0, 8)}_${receiverId.slice(0, 8)}_${timestamp}`;
  }, []);

  // Start a call
  const startCall = useCallback(async (receiverId: string, callType: 'voice' | 'video' = 'voice') => {
    if (!user || isAnyBlocked) {
      console.log('Cannot start call: blocked or not authenticated');
      return null;
    }

    const roomName = generateRoomName(user.id, receiverId);
    
    try {
      const { data, error } = await supabase
        .from('call_logs')
        .insert({
          caller_id: user.id,
          receiver_id: receiverId,
          room_name: roomName,
          call_type: callType,
          status: 'ringing'
        })
        .select(`
          *,
          caller:profiles!call_logs_caller_id_fkey (id, username, avatar_url, user_number),
          receiver:profiles!call_logs_receiver_id_fkey (id, username, avatar_url, user_number)
        `)
        .single();

      if (error) throw error;

      setActiveCall(data as CallLog);
      setCallStatus('calling');
      return data as CallLog;
    } catch (error) {
      console.error('Error starting call:', error);
      return null;
    }
  }, [user, isAnyBlocked, generateRoomName]);

  // Accept a call
  const acceptCall = useCallback(async (callId: string) => {
    try {
      const { data, error } = await supabase
        .from('call_logs')
        .update({
          status: 'ongoing',
          started_at: new Date().toISOString()
        })
        .eq('id', callId)
        .select(`
          *,
          caller:profiles!call_logs_caller_id_fkey (id, username, avatar_url, user_number),
          receiver:profiles!call_logs_receiver_id_fkey (id, username, avatar_url, user_number)
        `)
        .single();

      if (error) throw error;

      setActiveCall(data as CallLog);
      setIncomingCall(null);
      setCallStatus('connected');
      
      // Start duration timer
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);

      return data as CallLog;
    } catch (error) {
      console.error('Error accepting call:', error);
      return null;
    }
  }, []);

  // Reject a call
  const rejectCall = useCallback(async (callId: string) => {
    try {
      await supabase
        .from('call_logs')
        .update({
          status: 'rejected',
          ended_at: new Date().toISOString()
        })
        .eq('id', callId);

      setIncomingCall(null);
      setCallStatus('idle');
    } catch (error) {
      console.error('Error rejecting call:', error);
    }
  }, []);

  // End a call
  const endCall = useCallback(async () => {
    if (!activeCall) return;

    try {
      const endedAt = new Date().toISOString();
      const durationSeconds = callDuration;

      await supabase
        .from('call_logs')
        .update({
          status: 'completed',
          ended_at: endedAt,
          duration_seconds: durationSeconds
        })
        .eq('id', activeCall.id);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setActiveCall(null);
      setCallStatus('idle');
      setCallDuration(0);
    } catch (error) {
      console.error('Error ending call:', error);
    }
  }, [activeCall, callDuration]);

  // Cancel a call (caller cancels before answer)
  const cancelCall = useCallback(async () => {
    if (!activeCall) return;

    try {
      await supabase
        .from('call_logs')
        .update({
          status: 'cancelled',
          ended_at: new Date().toISOString()
        })
        .eq('id', activeCall.id);

      setActiveCall(null);
      setCallStatus('idle');
    } catch (error) {
      console.error('Error cancelling call:', error);
    }
  }, [activeCall]);

  // Subscribe to incoming calls
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('incoming-calls')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_logs',
          filter: `receiver_id=eq.${user.id}`
        },
        async (payload) => {
          const call = payload.new;
          if (call.status === 'ringing') {
            // Fetch full call with profiles
            const { data } = await supabase
              .from('call_logs')
              .select(`
                *,
                caller:profiles!call_logs_caller_id_fkey (id, username, avatar_url, user_number),
                receiver:profiles!call_logs_receiver_id_fkey (id, username, avatar_url, user_number)
              `)
              .eq('id', call.id)
              .single();

            if (data) {
              setIncomingCall(data as CallLog);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_logs'
        },
        (payload) => {
          const call = payload.new;
          
          // Handle call status updates
          if (activeCall && call.id === activeCall.id) {
            if (call.status === 'ongoing') {
              setCallStatus('connected');
              if (!timerRef.current) {
                timerRef.current = setInterval(() => {
                  setCallDuration(prev => prev + 1);
                }, 1000);
              }
            } else if (['completed', 'rejected', 'cancelled', 'missed'].includes(call.status)) {
              if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
              }
              setActiveCall(null);
              setCallStatus('idle');
              setCallDuration(0);
            }
          }

          // Handle incoming call updates
          if (incomingCall && call.id === incomingCall.id) {
            if (['cancelled', 'missed'].includes(call.status)) {
              setIncomingCall(null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [user, activeCall, incomingCall]);

  // Format duration
  const formatDuration = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    incomingCall,
    activeCall,
    callStatus,
    callDuration,
    formatDuration,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    cancelCall,
    isBlocked: isAnyBlocked
  };
};

// Hook to fetch call history
export const useCallHistory = () => {
  const { user } = useAuth();
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchCalls = async () => {
      const { data, error } = await supabase
        .from('call_logs')
        .select(`
          *,
          caller:profiles!call_logs_caller_id_fkey (id, username, avatar_url, user_number),
          receiver:profiles!call_logs_receiver_id_fkey (id, username, avatar_url, user_number)
        `)
        .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setCalls(data as CallLog[]);
      }
      setLoading(false);
    };

    fetchCalls();
  }, [user]);

  return { calls, loading };
};
