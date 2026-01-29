import { useState } from "react";
import { motion } from "framer-motion";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface NotificationPermissionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnable: () => Promise<boolean>;
  onSkip: () => void;
}

export const NotificationPermissionModal = ({
  open,
  onOpenChange,
  onEnable,
  onSkip,
}: NotificationPermissionModalProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleEnable = async () => {
    setIsLoading(true);
    try {
      const granted = await onEnable();
      if (granted) {
        onOpenChange(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    onSkip();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="sr-only">
          <DialogTitle>Enable Notifications</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center text-center py-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
            className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6"
          >
            <Bell className="h-10 w-10 text-primary" />
          </motion.div>

          <h2 className="text-xl font-semibold mb-2">Stay Connected</h2>
          
          <p className="text-muted-foreground text-sm max-w-xs mb-6">
            Turn on notifications so you don't miss messages and important updates on Mera.
          </p>

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <Button
              onClick={handleEnable}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? "Enabling..." : "Enable notifications"}
            </Button>
            
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="w-full text-muted-foreground"
            >
              Not now
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
