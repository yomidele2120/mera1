import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ReactNode } from "react";

interface StickyHeaderProps {
  title: string;
  onBack?: () => void;
  rightAction?: ReactNode;
  showBackButton?: boolean;
}

export const StickyHeader = ({ 
  title, 
  onBack, 
  rightAction,
  showBackButton = true 
}: StickyHeaderProps) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border safe-top">
      <div className="flex items-center gap-4 px-4 py-3">
        {showBackButton && (
          <button
            onClick={handleBack}
            className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-6 w-6 text-foreground" />
          </button>
        )}
        <h1 className="font-semibold text-lg text-foreground flex-1">{title}</h1>
        {rightAction && <div className="flex items-center">{rightAction}</div>}
      </div>
    </header>
  );
};
