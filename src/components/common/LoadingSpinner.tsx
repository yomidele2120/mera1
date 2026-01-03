import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

export const LoadingSpinner = ({ size = "md", className }: LoadingSpinnerProps) => {
  return (
    <Loader2
      className={cn(
        "animate-spin text-primary",
        sizeClasses[size],
        className
      )}
    />
  );
};

export const FullPageLoader = () => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-full gradient-primary animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-display text-2xl font-bold text-primary-foreground">M</span>
          </div>
        </div>
        <LoadingSpinner size="lg" />
      </div>
    </div>
  );
};
