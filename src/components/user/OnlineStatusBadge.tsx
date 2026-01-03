import { cn } from "@/lib/utils";

interface OnlineStatusBadgeProps {
  isOnline: boolean;
  showDot?: boolean;
  className?: string;
}

export const OnlineStatusBadge = ({ isOnline, showDot = true, className }: OnlineStatusBadgeProps) => {
  if (!showDot) return null;

  return (
    <span
      className={cn(
        "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background",
        isOnline ? "bg-green-500" : "bg-muted-foreground/50",
        className
      )}
    />
  );
};
