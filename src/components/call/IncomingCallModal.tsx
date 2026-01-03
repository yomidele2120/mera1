import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/common/Avatar";
import { UserNumber } from "@/components/user/UserNumber";
import type { CallLog } from "@/hooks/useCalling";

interface IncomingCallModalProps {
  call: CallLog | null;
  onAccept: (callId: string) => void;
  onReject: (callId: string) => void;
}

export const IncomingCallModal = ({ call, onAccept, onReject }: IncomingCallModalProps) => {
  if (!call) return null;

  const caller = call.caller;
  const isVideoCall = call.call_type === 'video';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="flex flex-col items-center gap-6 p-8"
        >
          {/* Caller Avatar with Pulse */}
          <div className="relative">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute inset-0 rounded-full bg-primary/30"
            />
            <UserAvatar
              src={caller?.avatar_url}
              fallback={caller?.username || 'U'}
              size="xl"
              className="h-32 w-32 border-4 border-primary"
            />
          </div>

          {/* Caller Info */}
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-foreground">
              {caller?.username}
            </h2>
            {caller?.user_number && (
              <UserNumber userNumber={caller.user_number} showCopyButton={false} className="justify-center" />
            )}
            <p className="text-muted-foreground flex items-center justify-center gap-2">
              {isVideoCall ? (
                <>
                  <Video className="h-4 w-4" />
                  Incoming video call...
                </>
              ) : (
                <>
                  <Phone className="h-4 w-4" />
                  Incoming voice call...
                </>
              )}
            </p>
          </div>

          {/* Call Actions */}
          <div className="flex items-center gap-8 mt-4">
            <Button
              variant="destructive"
              size="lg"
              className="h-16 w-16 rounded-full"
              onClick={() => onReject(call.id)}
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
            <Button
              size="lg"
              className="h-16 w-16 rounded-full bg-green-500 hover:bg-green-600"
              onClick={() => onAccept(call.id)}
            >
              <Phone className="h-6 w-6" />
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
