import { Check, CheckCheck, Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ReadReceiptProps {
  seen: boolean;
  createdAt: string;
  seenAt?: string | null;
  isOwn: boolean;
  className?: string;
}

export const ReadReceipt = ({
  seen,
  createdAt,
  seenAt,
  isOwn,
  className,
}: ReadReceiptProps) => {
  if (!isOwn) return null;

  const sentTime = format(new Date(createdAt), "h:mm a");
  const sentDate = format(new Date(createdAt), "MMM d, yyyy");
  const readTime = seenAt ? format(new Date(seenAt), "h:mm a") : null;
  const readDate = seenAt ? format(new Date(seenAt), "MMM d, yyyy") : null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "inline-flex items-center gap-0.5 cursor-help",
            className
          )}
        >
          {seen ? (
            <CheckCheck className="h-3.5 w-3.5 text-primary-foreground/80" />
          ) : (
            <Check className="h-3.5 w-3.5 text-primary-foreground/60" />
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="left"
        className="bg-popover text-popover-foreground border border-border shadow-lg p-3 max-w-[200px]"
      >
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <div>
              <p className="font-medium">Sent</p>
              <p className="text-muted-foreground">
                {sentDate} at {sentTime}
              </p>
            </div>
          </div>
          {seen && (
            <div className="flex items-center gap-2">
              <CheckCheck className="h-3 w-3 text-primary" />
              <div>
                <p className="font-medium">Read</p>
                <p className="text-muted-foreground">
                  {readDate && readTime
                    ? `${readDate} at ${readTime}`
                    : "Just now"}
                </p>
              </div>
            </div>
          )}
          {!seen && (
            <div className="flex items-center gap-2">
              <Check className="h-3 w-3 text-muted-foreground" />
              <div>
                <p className="font-medium">Delivered</p>
                <p className="text-muted-foreground">Not read yet</p>
              </div>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
