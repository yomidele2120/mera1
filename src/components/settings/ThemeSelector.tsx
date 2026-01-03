import { Sun, Moon, Monitor } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

const themes = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
] as const;

export const ThemeSelector = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex gap-3 p-4">
      {themes.map((t) => {
        const Icon = t.icon;
        const isActive = theme === t.id;

        return (
          <motion.button
            key={t.id}
            whileTap={{ scale: 0.95 }}
            onClick={() => setTheme(t.id)}
            className={cn(
              "flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
              isActive
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50"
            )}
          >
            <Icon
              className={cn(
                "h-6 w-6",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            />
            <span
              className={cn(
                "text-sm font-medium",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              {t.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
};
