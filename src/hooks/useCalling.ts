import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useBlocking } from './useBlocking';

export interface CallLog {
  id: string;
  caller_id: string;
  callee_id: string;
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

const CALL_SELECT = `
  *,
  caller:profiles!calls_caller_id_fkey (id, username, avatar_url, user_number),
  receiver:profiles!calls_callee_id_fkey (id, username, avatar_url, user_number)
`;

export const useCalling = ({ otherUserId }: UseCallingProps = {}) => {
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState<CallLog | null>(null);
  const [activeCall, setActiveCall] = useState<CallLog | null>(null);
  const [callStatus, setCallStatus] = useState<string>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeCallRef = useRef<CallLog | null>(null);
  const incomingCallRef = useRef<CallLog | null>(null);
  
  const { isAnyBlocked } = useBlocking(otherUserId);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  const clearCallTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startCallTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  }, []);

  // Generate room name
  const generateRoomName = useCallback((callerId: string, receiverId: string) => {
    const timestamp = Date.now();
    return `call_${callerId.slice(0, 8)}_${receiverId.slice(0, 8)}_${timestamp}`;
  }, []);

  const fetchCallById = useCallback(async (callId: string) => {
    const { data, error } = await supabase
      .from('calls')
      .select(CALL_SELECT)
      .eq('id', callId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching call:', error);
      return null;
    }

    return (data as CallLog | null) ?? null;
  }, []);

  const reconcileCallState = useCallback((call: CallLog) => {
    const isCurrentActive = activeCallRef.current?.id === call.id;
    const isCurrentIncoming = incomingCallRef.current?.id === call.id;
    const isParticipant = call.caller_id === user?.id || call.callee_id === user?.id;

    if (!isParticipant) return;

    if (call.status === 'ringing' && call.callee_id === user?.id && !activeCallRef.current) {
      setIncomingCall(call);
      return;
    }

    if (call.status === 'ongoing') {
      if (isCurrentActive || isCurrentIncoming || call.caller_id === user?.id || call.callee_id === user?.id) {
        setActiveCall(call);
        setIncomingCall(null);
        setCallStatus('connected');
        startCallTimer();
      }
      return;
    }

    if (['completed', 'rejected', 'cancelled', 'missed'].includes(call.status)) {
      if (isCurrentActive || isCurrentIncoming) {
        clearCallTimer();
        setActiveCall(null);
        setIncomingCall(null);
        setCallStatus('idle');
        setCallDuration(0);
      }
    }
  }, [clearCallTimer, startCallTimer, user?.id]);

  // Start a call
  const startCall = useCallback(async (receiverId: string, callType: 'voice' | 'video' = 'voice') => {
    if (!user || isAnyBlocked) {
      console.log('Cannot start call: blocked or not authenticated');
      return null;
    }

    const roomName = generateRoomName(user.id, receiverId);
    
    try {
      const { data, error } = await supabase
        .from('calls')
        .insert({
          caller_id: user.id,
          callee_id: receiverId,
          room_name: roomName,
          call_type: callType,
          status: 'ringing'
        })
        .select(CALL_SELECT)
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
        .from('calls')
        .update({
          status: 'ongoing',
          started_at: new Date().toISOString()
        })
        .eq('id', callId)
        .select(CALL_SELECT)
        .single();

      if (error) throw error;

      setActiveCall(data as CallLog);
      setIncomingCall(null);
      setCallStatus('connected');
      startCallTimer();

      return data as CallLog;
    } catch (error) {
      console.error('Error accepting call:', error);
      return null;
    }
  }, [startCallTimer]);

  // Reject a call
  const rejectCall = useCallback(async (callId: string) => {
    try {
      const { error } = await supabase
        .from('calls')
        .update({
          status: 'rejected',
          ended_at: new Date().toISOString()
        })
        .eq('id', callId);

      if (error) throw error;

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

      const { error } = await supabase
        .from('calls')
        .update({
          status: 'completed',
          ended_at: endedAt,
          duration_seconds: durationSeconds
        })
        .eq('id', activeCall.id);

      if (error) throw error;

      clearCallTimer();

      setActiveCall(null);
      setCallStatus('idle');
      setCallDuration(0);
    } catch (error) {
      console.error('Error ending call:', error);
    }
  }, [activeCall, callDuration, clearCallTimer]);

  // Cancel a call (caller cancels before answer)
  const cancelCall = useCallback(async () => {
    if (!activeCall) return;

    try {
      const { error } = await supabase
        .from('calls')
        .update({
          status: 'cancelled',
          ended_at: new Date().toISOString()
        })
        .eq('id', activeCall.id);

      if (error) throw error;

      setActiveCall(null);
      setCallStatus('idle');
    } catch (error) {
      console.error('Error cancelling call:', error);
    }
  }, [activeCall]);

  // Subscribe to incoming calls/status changes. Keep this subscription stable and use refs
  // so quick accept/decline updates are not missed during React re-renders.
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('incoming-calls')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'calls',
          filter: `callee_id=eq.${user.id}`
        },
        async (payload) => {
          console.log('incoming call received', payload);
          const call = payload.new;
          if (call.status === 'ringing') {
            const fullCall = await fetchCallById(call.id);
            if (fullCall) reconcileCallState(fullCall);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'calls'
        },
        async (payload) => {
          console.log('call status update received', payload);
          const call = payload.new;
          const fullCall = await fetchCallById(call.id);
          reconcileCallState(fullCall ?? (call as CallLog));
        }
      )
      .subscribe((status) => {
        console.log('incoming-calls subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCallById, reconcileCallState, user]);

  // If realtime is briefly disconnected or the callee opened the app after the call was created,
  // poll the current call as a safety net so Accept/Decline/Cancel still resolves.
  useEffect(() => {
    if (!user || !activeCall || !['calling', 'connected'].includes(callStatus)) return;

    const interval = setInterval(async () => {
      const fullCall = await fetchCallById(activeCall.id);
      if (fullCall) reconcileCallState(fullCall);
    }, 2000);

    return () => clearInterval(interval);
  }, [activeCall, callStatus, fetchCallById, reconcileCallState, user]);

  // Pick up any ringing call that already exists when the provider mounts.
  useEffect(() => {
    if (!user) return;

    const fetchPendingIncomingCall = async () => {
      const { data, error } = await supabase
        .from('calls')
        .select(CALL_SELECT)
        .eq('callee_id', user.id)
        .eq('status', 'ringing')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching pending call:', error);
        return;
      }

      if (data) reconcileCallState(data as CallLog);
    };

    fetchPendingIncomingCall();
  }, [reconcileCallState, user]);

  useEffect(() => {
    return () => clearCallTimer();
  }, [clearCallTimer]);

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
        .from('calls')
        .select(`
          *,
          caller:profiles!calls_caller_id_fkey (id, username, avatar_url, user_number),
          receiver:profiles!calls_callee_id_fkey (id, username, avatar_url, user_number)
        `)
        .or(`caller_id.eq.${user.id},callee_id.eq.${user.id}`)
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
