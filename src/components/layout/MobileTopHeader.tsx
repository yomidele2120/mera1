import { Bell, MessageCircle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useNotificationBadges } from "@/hooks/useNotificationBadges";

export const MobileTopHeader = () => {
  const location = useLocation();
  const { unreadMessages, unreadNotifications } = useNotificationBadges();

  // Only show on the news feed (home page)
  if (location.pathname !== "/" && location.pathname !== "/feed") return null;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/60 safe-top md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left - Notifications */}
        <Link
          to="/notifications"
          className="relative p-2 -m-2 rounded-full text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-[22px] w-[22px]" strokeWidth={2} />
          {unreadNotifications > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full gradient-primary text-[10px] font-bold flex items-center justify-center text-primary-foreground gradient-glow">
              {unreadNotifications > 9 ? "9+" : unreadNotifications}
            </span>
          )}
        </Link>

        {/* Center - Wordmark */}
        <Link
          to="/"
          className="absolute left-1/2 -translate-x-1/2"
          aria-label="Home"
        >
          <span
            className="font-display text-[26px] font-extrabold tracking-tight leading-none"
            style={{
              backgroundImage: "var(--gradient-primary)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              letterSpacing: "-0.02em",
            }}
          >
            Mera
          </span>
        </Link>

        {/* Right - Messages */}
        <Link
          to="/messages"
          className="relative p-2 -m-2 rounded-full text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Messages"
        >
          <MessageCircle className="h-[22px] w-[22px]" strokeWidth={2} />
          {unreadMessages > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full gradient-primary text-[10px] font-bold flex items-center justify-center text-primary-foreground gradient-glow">
              {unreadMessages > 9 ? "9+" : unreadMessages}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
};
