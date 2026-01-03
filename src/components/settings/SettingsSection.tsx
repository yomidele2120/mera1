import { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsSectionProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export const SettingsSection = ({
  title,
  description,
  children,
}: SettingsSectionProps) => {
  return (
    <div className="card-base p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
};

interface SettingsItemProps {
  icon?: ReactNode;
  label: string;
  description?: string;
  action?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
}

export const SettingsItem = ({
  icon,
  label,
  description,
  action,
  onClick,
  danger,
}: SettingsItemProps) => {
  const Comp = onClick ? "button" : "div";

  return (
    <Comp
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 w-full px-4 py-3 text-left transition-colors",
        onClick && "hover:bg-muted/50 cursor-pointer",
        danger && "text-destructive hover:bg-destructive/10"
      )}
    >
      {icon && (
        <div className={cn("text-muted-foreground", danger && "text-destructive")}>
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className={cn("font-medium", danger && "text-destructive")}>{label}</p>
        {description && (
          <p className="text-sm text-muted-foreground truncate">{description}</p>
        )}
      </div>
      {action ? action : onClick && <ChevronRight className="h-5 w-5 text-muted-foreground" />}
    </Comp>
  );
};
