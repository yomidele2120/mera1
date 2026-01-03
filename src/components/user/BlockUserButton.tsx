import { Ban, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface BlockUserButtonProps {
  isBlocked: boolean;
  onBlock: () => void;
  onUnblock: () => void;
  loading?: boolean;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

export const BlockUserButton = ({
  isBlocked,
  onBlock,
  onUnblock,
  loading,
  variant = "ghost",
}: BlockUserButtonProps) => {
  if (isBlocked) {
    return (
      <Button
        variant={variant}
        size="sm"
        onClick={onUnblock}
        disabled={loading}
        className="text-muted-foreground"
      >
        <UserX className="h-4 w-4 mr-1" />
        Unblock
      </Button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size="sm" className="text-destructive">
          <Ban className="h-4 w-4 mr-1" />
          Block
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Block this user?</AlertDialogTitle>
          <AlertDialogDescription>
            They won't be able to find your profile, posts, or stories, or send you
            messages. They won't be notified that you blocked them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onBlock} disabled={loading}>
            Block
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
