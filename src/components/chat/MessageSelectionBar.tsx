import { X, Copy, Forward, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface MessageSelectionBarProps {
  selectedCount: number;
  onCancel: () => void;
  onCopy: () => void;
  onForward: () => void;
  onDelete: () => void;
  canDelete: boolean;
}

export const MessageSelectionBar = ({
  selectedCount,
  onCancel,
  onCopy,
  onForward,
  onDelete,
  canDelete,
}: MessageSelectionBarProps) => {
  return (
    <motion.div
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -50, opacity: 0 }}
      className="absolute top-0 left-0 right-0 z-20 bg-primary text-primary-foreground p-3 flex items-center justify-between"
    >
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onCancel} className="text-primary-foreground hover:bg-primary-foreground/20">
          <X className="h-5 w-5" />
        </Button>
        <span className="font-medium">{selectedCount} selected</span>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onCopy} className="text-primary-foreground hover:bg-primary-foreground/20">
          <Copy className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onForward} className="text-primary-foreground hover:bg-primary-foreground/20">
          <Forward className="h-5 w-5" />
        </Button>
        {canDelete && (
          <Button variant="ghost" size="icon" onClick={onDelete} className="text-primary-foreground hover:bg-primary-foreground/20">
            <Trash2 className="h-5 w-5" />
          </Button>
        )}
      </div>
    </motion.div>
  );
};
