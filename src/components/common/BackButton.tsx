import { ArrowLeft, Home } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  className?: string;
  fallbackPath?: string;
  showHomeOption?: boolean;
}

export const BackButton = ({ 
  className, 
  fallbackPath = "/",
  showHomeOption = false 
}: BackButtonProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    // Check if there's history to go back to
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate(fallbackPath);
    }
  };

  const handleHome = () => {
    navigate("/");
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={handleBack}
        className="h-9 w-9"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>
      {showHomeOption && location.pathname !== "/" && (
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleHome}
          className="h-9 w-9"
        >
          <Home className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
