import { Home, Search, PlusSquare, MessageCircle, User, Bell, Moon, Sun, LogOut, Settings, Phone, Users } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNotificationBadges } from "@/hooks/useNotificationBadges";

const navItems = [
  { icon: Home, path: "/", label: "Home", badgeKey: null },
  { icon: Search, path: "/search", label: "Search", badgeKey: null },
  { icon: PlusSquare, path: "/create", label: "Create", badgeKey: null },
  { icon: MessageCircle, path: "/messages", label: "Messages", badgeKey: "unreadMessages" as const },
  { icon: Users, path: "/friends", label: "Friends", badgeKey: "pendingFriendRequests" as const },
  { icon: Phone, path: "/calls", label: "Calls", badgeKey: "missedCalls" as const },
  { icon: Bell, path: "/notifications", label: "Notifications", badgeKey: "unreadNotifications" as const },
];

export const DesktopNav = () => {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { profile, signOut } = useAuth();
  const { unreadMessages, pendingFriendRequests, missedCalls, unreadNotifications } = useNotificationBadges();

  const getBadgeCount = (key: string | null) => {
    if (!key) return 0;
    if (key === "unreadMessages") return unreadMessages;
    if (key === "pendingFriendRequests") return pendingFriendRequests;
    if (key === "missedCalls") return missedCalls;
    if (key === "unreadNotifications") return unreadNotifications;
    return 0;
  };

  return (
    <aside className="fixed left-0 top-0 z-50 hidden h-screen w-64 flex-col border-r border-border bg-sidebar p-4 md:flex lg:w-72">
      {/* Logo */}
      <Link to="/" className="mb-8 flex items-center gap-3 px-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-glow">
          <span className="font-display text-xl font-bold text-primary-foreground">M</span>
        </div>
        <span className="font-display text-2xl font-bold text-gradient">mera</span>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          const badgeCount = getBadgeCount(item.badgeKey);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "nav-item group relative",
                isActive && "nav-item-active"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="desktop-nav-indicator"
                  className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full gradient-primary"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <div className="relative">
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                {badgeCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-medium">
                    {badgeCount > 9 ? "9+" : badgeCount}
                  </span>
                )}
              </div>
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}

        {/* Profile Link */}
        <Link
          to="/profile"
          className={cn(
            "nav-item group relative",
            location.pathname === "/profile" && "nav-item-active"
          )}
        >
          {location.pathname === "/profile" && (
            <motion.div
              layoutId="desktop-nav-indicator"
              className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full gradient-primary"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <Avatar className="h-6 w-6">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="text-xs gradient-primary text-primary-foreground">
              {profile?.username?.[0]?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium">Profile</span>
        </Link>
      </nav>

      {/* Bottom Actions */}
      <div className="space-y-1 border-t border-border pt-4">
        <Link
          to="/settings"
          className={cn(
            "nav-item group relative",
            location.pathname === "/settings" && "nav-item-active"
          )}
        >
          {location.pathname === "/settings" && (
            <motion.div
              layoutId="desktop-nav-indicator"
              className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full gradient-primary"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <Settings className="h-5 w-5" />
          <span className="font-medium">Settings</span>
        </Link>
        <button
          onClick={toggleTheme}
          className="nav-item w-full"
        >
          {theme === "dark" ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
          <span className="font-medium">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
        </button>
        <button
          onClick={signOut}
          className="nav-item w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-5 w-5" />
          <span className="font-medium">Sign out</span>
        </button>
      </div>
    </aside>
  );
};
