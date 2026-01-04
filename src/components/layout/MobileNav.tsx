import { Home, Search, PlusSquare, MessageCircle, Users, Bell } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useNotificationBadges } from "@/hooks/useNotificationBadges";

const navItems = [
  { icon: Home, path: "/", label: "Home", badgeKey: null },
  { icon: Search, path: "/search", label: "Search", badgeKey: null },
  { icon: PlusSquare, path: "/create", label: "Create", badgeKey: null },
  { icon: MessageCircle, path: "/messages", label: "Messages", badgeKey: "unreadMessages" as const },
  { icon: Users, path: "/friends", label: "Friends", badgeKey: "pendingFriendRequests" as const },
];

export const MobileNav = () => {
  const location = useLocation();
  const { unreadMessages, pendingFriendRequests, unreadNotifications } = useNotificationBadges();

  const getBadgeCount = (key: string | null) => {
    if (!key) return 0;
    if (key === "unreadMessages") return unreadMessages;
    if (key === "pendingFriendRequests") return pendingFriendRequests;
    return 0;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border/50 safe-bottom md:hidden">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          const badgeCount = getBadgeCount(item.badgeKey);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "relative flex flex-col items-center gap-0.5 px-4 py-2 transition-all duration-200",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="mobile-nav-indicator"
                  className="absolute -top-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full gradient-primary"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <div className="relative">
                <Icon
                  className={cn(
                    "h-6 w-6 transition-transform duration-200",
                    isActive && "scale-110"
                  )}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {badgeCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-medium">
                    {badgeCount > 9 ? "9+" : badgeCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
