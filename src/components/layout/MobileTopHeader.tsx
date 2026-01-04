import { Bell, Users, MessageCircle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useNotificationBadges } from "@/hooks/useNotificationBadges";

export const MobileTopHeader = () => {
  const location = useLocation();
  const { unreadMessages, pendingFriendRequests, unreadNotifications } = useNotificationBadges();

  // Only show on the news feed (home page)
  if (location.pathname !== "/" && location.pathname !== "/feed") return null;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50 safe-top md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left side - Notifications & Friends */}
        <div className="flex items-center gap-4">
          <Link
            to="/notifications"
            className="relative p-2 rounded-full transition-colors text-muted-foreground hover:bg-muted"
          >
            <Bell className="h-5 w-5" />
            {unreadNotifications > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-medium">
                {unreadNotifications > 9 ? "9+" : unreadNotifications}
              </span>
            )}
          </Link>
          <Link
            to="/friends"
            className="relative p-2 rounded-full transition-colors text-muted-foreground hover:bg-muted"
          >
            <Users className="h-5 w-5" />
            {pendingFriendRequests > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-medium">
                {pendingFriendRequests > 9 ? "9+" : pendingFriendRequests}
              </span>
            )}
          </Link>
        </div>

        {/* Center - App name/logo */}
        <Link to="/" className="font-display text-xl font-bold text-foreground">
          Mera
        </Link>

        {/* Right side - Messages */}
        <div className="flex items-center gap-4">
          <Link
            to="/messages"
            className="relative p-2 rounded-full transition-colors text-muted-foreground hover:bg-muted"
          >
            <MessageCircle className="h-5 w-5" />
            {unreadMessages > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-medium">
                {unreadMessages > 9 ? "9+" : unreadMessages}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
};
