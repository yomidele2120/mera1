import { createContext, useContext, ReactNode, useEffect } from "react";
import { useCalling, CallLog } from "@/hooks/useCalling";
import { useAuth } from "@/contexts/AuthContext";
import { IncomingCallModal } from "./IncomingCallModal";
import { CallingScreen } from "./CallingScreen";
import { VideoCall } from "@/components/livekit/VideoCall";
import { useLiveKitCall } from "@/hooks/useLiveKitCall";

interface CallContextType {
  startCall: (receiverId: string, callType?: "voice" | "video") => Promise<CallLog | null>;
  incomingCall: CallLog | null;
  activeCall: CallLog | null;
  callStatus: string;
  isBlocked: boolean;
}

const CallContext = createContext<CallContextType | null>(null);

export const useCallContext = () => {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCallContext must be used within CallProvider");
  return ctx;
};

interface CallProviderProps {
  children: ReactNode;
}

/**
 * Renders LiveKit room once a call has been accepted (status connected).
 * Fetches a token scoped to the call's room_name for the current user.
 */
const ConnectedCall = ({
  call,
  onDisconnected,
}: {
  call: CallLog;
  onDisconnected: () => void;
}) => {
  const { user, profile } = useAuth();
  const { status, token, livekitUrl, error, joinRoom } = useLiveKitCall({
    participantName: profile?.username ?? user?.email ?? "User",
    participantIdentity: user?.id ?? "unknown",
  });

  useEffect(() => {
    joinRoom(call.room_name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.room_name]);

  useEffect(() => {
    if (status === "error" && error) {
      console.error("LiveKit connect error:", error);
      onDisconnected();
    }
  }, [status, error, onDisconnected]);

  if (!token) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black text-white">
        <p className="text-sm opacity-70">Connecting…</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      <VideoCall
        token={token}
        serverUrl={livekitUrl}
        roomName={call.room_name}
        callMode={call.call_type === "video" ? "video" : "voice"}
        onDisconnected={onDisconnected}
      />
    </div>
  );
};

export const CallProvider = ({ children }: CallProviderProps) => {
  const { user } = useAuth();
  const {
    incomingCall,
    activeCall,
    callStatus,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    cancelCall,
    isBlocked,
  } = useCalling();

  const getOtherUserInfo = () => {
    if (!activeCall) return { username: "", avatarUrl: null, userNumber: null };
    const other = activeCall.caller_id === user?.id ? activeCall.receiver : activeCall.caller;
    return {
      username: other?.username || "",
      avatarUrl: other?.avatar_url || null,
      userNumber: other?.user_number || null,
    };
  };

  return (
    <CallContext.Provider
      value={{ startCall, incomingCall, activeCall, callStatus, isBlocked }}
    >
      {children}

      {/* Callee: incoming ringing modal */}
      <IncomingCallModal call={incomingCall} onAccept={acceptCall} onReject={rejectCall} />

      {/* Caller: waiting for pickup */}
      {callStatus === "calling" && activeCall && (
        <CallingScreen
          username={getOtherUserInfo().username}
          avatarUrl={getOtherUserInfo().avatarUrl}
          userNumber={getOtherUserInfo().userNumber}
          onCancel={cancelCall}
        />
      )}

      {/* Both sides once accepted: real LiveKit room */}
      {callStatus === "connected" && activeCall && (
        <ConnectedCall call={activeCall} onDisconnected={endCall} />
      )}
    </CallContext.Provider>
  );
};
