import { cn } from "@/lib/utils";
import { Avatar as ShadcnAvatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AvatarProps {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  hasStory?: boolean;
  hasUnseenStory?: boolean;
  className?: string;
}

const sizeClasses = {
  xs: "h-6 w-6",
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
  xl: "h-20 w-20",
};

const fallbackSizeClasses = {
  xs: "text-[10px]",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-lg",
  xl: "text-2xl",
};

export const UserAvatar = ({
  src,
  alt,
  fallback = "U",
  size = "md",
  hasStory = false,
  hasUnseenStory = false,
  className,
}: AvatarProps) => {
  const avatarContent = (
    <ShadcnAvatar className={cn(sizeClasses[size], className)}>
      <AvatarImage src={src || undefined} alt={alt} className="object-cover" />
      <AvatarFallback className={cn("gradient-primary text-primary-foreground font-semibold", fallbackSizeClasses[size])}>
        {fallback[0]?.toUpperCase()}
      </AvatarFallback>
    </ShadcnAvatar>
  );

  if (hasStory) {
    return (
      <div
        className={cn(
          "p-0.5 rounded-full",
          hasUnseenStory ? "gradient-story" : "bg-muted"
        )}
      >
        <div className="p-0.5 rounded-full bg-background">
          {avatarContent}
        </div>
      </div>
    );
  }

  return avatarContent;
};
