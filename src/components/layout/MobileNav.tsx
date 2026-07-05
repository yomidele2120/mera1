import { Home, Search, PlusSquare, Users, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, path: "/", label: "Home" },
  { icon: Search, path: "/search", label: "Search" },
  { icon: PlusSquare, path: "/create", label: "Create" },
  { icon: Users, path: "/friends", label: "Friends" },
  { icon: Settings, path: "/settings", label: "Settings" },
];

const haptic = () => {
  try {
    if ("vibrate" in navigator) navigator.vibrate(8);
  } catch {
    /* noop */
  }
};

export const MobileNav = () => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border/60 safe-bottom md:hidden">
      <div className="relative flex items-stretch justify-around px-2 py-1.5">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={haptic}
              className="relative flex flex-1 flex-col items-center justify-center gap-1 px-2 py-2"
            >
              {isActive && (
                <motion.div
                  layoutId="mobile-nav-active"
                  className="absolute inset-x-3 inset-y-1 rounded-2xl gradient-primary opacity-[0.14]"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              {isActive && (
                <motion.span
                  layoutId="mobile-nav-dot"
                  className="absolute -top-0.5 h-1 w-1 rounded-full gradient-primary"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <motion.div
                animate={{ scale: isActive ? 1.08 : 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 24 }}
                className="relative"
              >
                <Icon
                  className={cn(
                    "h-[22px] w-[22px] transition-colors",
                    isActive ? "text-transparent" : "text-muted-foreground"
                  )}
                  strokeWidth={isActive ? 2.4 : 2}
                  style={
                    isActive
                      ? {
                          stroke: "url(#nav-grad)",
                        }
                      : undefined
                  }
                />
              </motion.div>
              <span
                className={cn(
                  "text-[10px] font-medium tracking-tight transition-colors",
                  isActive ? "text-transparent bg-clip-text gradient-primary" : "text-muted-foreground"
                )}
                style={
                  isActive
                    ? {
                        backgroundImage: "var(--gradient-primary)",
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                      }
                    : undefined
                }
              >
                {item.label}
              </span>
            </Link>
          );
        })}
        {/* SVG gradient definition for stroked icons */}
        <svg width="0" height="0" className="absolute">
          <defs>
            <linearGradient id="nav-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(15, 95%, 55%)" />
              <stop offset="55%" stopColor="hsl(28, 100%, 58%)" />
              <stop offset="100%" stopColor="hsl(42, 100%, 60%)" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </nav>
  );
};
