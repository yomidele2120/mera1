import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UserNumberProps {
  userNumber: number | null;
  className?: string;
  showCopyButton?: boolean;
}

export const UserNumber = ({ userNumber, className, showCopyButton = true }: UserNumberProps) => {
  const [copied, setCopied] = useState(false);

  if (!userNumber) return null;

  // Format as XXX-XXX-XXXX for 10-digit numbers starting with 90
  const numStr = userNumber.toString();
  const formattedNumber = numStr.length === 10 
    ? numStr.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")
    : numStr.replace(/(\d{3})(\d{3})(\d{3,})/, "$1-$2-$3");

  const handleCopy = () => {
    navigator.clipboard.writeText(userNumber.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-sm font-mono text-muted-foreground">
        ID: {formattedNumber}
      </span>
      {showCopyButton && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      )}
    </div>
  );
};
