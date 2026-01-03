import { motion } from "framer-motion";
import { Phone, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/common/Avatar";
import { UserNumber } from "@/components/user/UserNumber";

interface CallingScreenProps {
  username: string;
  avatarUrl: string | null;
  userNumber: number | null;
  onCancel: () => void;
}

export const CallingScreen = ({ username, avatarUrl, userNumber, onCancel }: CallingScreenProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-6 p-8">
        {/* Calling Animation */}
        <div className="relative">
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-[-20px] rounded-full bg-primary/20"
          />
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.1, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
            className="absolute inset-[-40px] rounded-full bg-primary/10"
          />
          <UserAvatar
            src={avatarUrl}
            fallback={username}
            size="xl"
            className="h-32 w-32 border-4 border-primary/50"
          />
        </div>

        {/* User Info */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">{username}</h2>
          {userNumber && (
            <UserNumber userNumber={userNumber} showCopyButton={false} className="justify-center" />
          )}
          <motion.p
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="text-muted-foreground flex items-center justify-center gap-2"
          >
            <Phone className="h-4 w-4" />
            Calling...
          </motion.p>
        </div>

        {/* Cancel Button */}
        <Button
          variant="destructive"
          size="lg"
          className="h-16 w-16 rounded-full mt-4"
          onClick={onCancel}
        >
          <PhoneOff className="h-6 w-6" />
        </Button>
      </div>
    </motion.div>
  );
};
