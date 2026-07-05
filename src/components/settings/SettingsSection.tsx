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
    <div className="space-y-2">
      {/* Section header — uppercase, small, muted (iOS-style) */}
      <div className="px-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {title}
        </h3>
        {description && (
          <p className="text-xs text-muted-foreground/80 mt-0.5">{description}</p>
        )}
      </div>
      <div className="rounded-2xl bg-card border border-border/60 overflow-hidden shadow-card divide-y divide-border/60">
        {children}
      </div>
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
        "group flex items-center gap-3 w-full px-4 py-3.5 text-left transition-colors",
        onClick && "hover:bg-muted/40 active:bg-muted/60 cursor-pointer",
        danger && "hover:bg-destructive/10"
      )}
    >
      {icon && (
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground [&>svg]:h-[18px] [&>svg]:w-[18px]",
            danger && "bg-destructive/10 text-destructive"
          )}
        >
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-[15px] font-medium leading-tight text-foreground",
            danger && "text-destructive"
          )}
        >
          {label}
        </p>
        {description && (
          <p className="text-[13px] text-muted-foreground truncate mt-0.5">
            {description}
          </p>
        )}
      </div>
      {action ? (
        <div className="shrink-0">{action}</div>
      ) : (
        onClick && (
          <ChevronRight className="h-4 w-4 text-muted-foreground/70 transition-transform group-active:translate-x-0.5" />
        )
      )}
    </Comp>
  );
};
