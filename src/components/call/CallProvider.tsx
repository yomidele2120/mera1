import { createContext, useContext, ReactNode } from "react";
import { useCalling, CallLog } from "@/hooks/useCalling";
import { useAuth } from "@/contexts/AuthContext";
import { IncomingCallModal } from "./IncomingCallModal";
import { CallingScreen } from "./CallingScreen";
import { ActiveCallScreen } from "./ActiveCallScreen";

interface CallContextType {
  startCall: (receiverId: string, callType?: 'voice' | 'video') => Promise<CallLog | null>;
  incomingCall: CallLog | null;
  activeCall: CallLog | null;
  callStatus: string;
  isBlocked: boolean;
}

const CallContext = createContext<CallContextType | null>(null);

export const useCallContext = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCallContext must be used within CallProvider');
  }
  return context;
};

interface CallProviderProps {
  children: ReactNode;
}

export const CallProvider = ({ children }: CallProviderProps) => {
  const { user } = useAuth();
  const {
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
    isBlocked
  } = useCalling();

  const getOtherUserInfo = () => {
    if (!activeCall) return { username: '', avatarUrl: null, userNumber: null };
    const otherUser = activeCall.caller_id === user?.id ? activeCall.receiver : activeCall.caller;
    return {
      username: otherUser?.username || '',
      avatarUrl: otherUser?.avatar_url || null,
      userNumber: otherUser?.user_number || null
    };
  };

  return (
    <CallContext.Provider value={{ startCall, incomingCall, activeCall, callStatus, isBlocked }}>
      {children}

      {/* Incoming Call Modal */}
      <IncomingCallModal
        call={incomingCall}
        onAccept={acceptCall}
        onReject={rejectCall}
      />

      {/* Calling Screen (when calling someone) */}
      {callStatus === 'calling' && activeCall && (
        <CallingScreen
          username={getOtherUserInfo().username}
          avatarUrl={getOtherUserInfo().avatarUrl}
          userNumber={getOtherUserInfo().userNumber}
          onCancel={cancelCall}
        />
      )}

      {/* Active Call Screen */}
      {callStatus === 'connected' && activeCall && user && (
        <ActiveCallScreen
          call={activeCall}
          currentUserId={user.id}
          duration={formatDuration(callDuration)}
          onEnd={endCall}
        />
      )}
    </CallContext.Provider>
  );
};
