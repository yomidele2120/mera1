import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UserNumberProps {
  userNumber: number | null;
  className?: string;
  showCopyButton?: boolean;
  /** Hide the ID text and render only the copy button (useful in dense rows). */
  copyOnly?: boolean;
}

export const UserNumber = ({
  userNumber,
  className,
  showCopyButton = true,
  copyOnly = false,
}: UserNumberProps) => {
  const [copied, setCopied] = useState(false);

  if (!userNumber) return null;

  const numStr = userNumber.toString();
  const formattedNumber =
    numStr.length === 10
      ? numStr.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")
      : numStr.replace(/(\d{3})(\d{3})(\d{3,})/, "$1-$2-$3");

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(userNumber.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {!copyOnly && (
        <span className="text-sm font-mono text-muted-foreground">
          ID: {formattedNumber}
        </span>
      )}
      {showCopyButton && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 rounded-lg hover:bg-muted"
          onClick={handleCopy}
          aria-label="Copy user ID"
        >
          {copied ? (
            <Check className="h-4 w-4 text-primary" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  );
};
