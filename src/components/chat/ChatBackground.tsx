import { cn } from "@/lib/utils";

interface ChatBackgroundProps {
  backgroundUrl: string | null;
  children: React.ReactNode;
}

export const ChatBackground = ({ backgroundUrl, children }: ChatBackgroundProps) => {
  return (
    <div className="relative flex-1 overflow-hidden">
      {backgroundUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${backgroundUrl})` }}
        >
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
        </div>
      )}
      <div className={cn("relative h-full", backgroundUrl && "bg-transparent")}>
        {children}
      </div>
    </div>
  );
};
