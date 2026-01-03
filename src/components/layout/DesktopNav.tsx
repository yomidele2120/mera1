import { Home, Search, PlusSquare, MessageCircle, User, Bell, Moon, Sun, LogOut, Settings, Phone } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const navItems = [
  { icon: Home, path: "/", label: "Home" },
  { icon: Search, path: "/search", label: "Search" },
  { icon: PlusSquare, path: "/create", label: "Create" },
  { icon: MessageCircle, path: "/messages", label: "Messages" },
  { icon: Phone, path: "/calls", label: "Calls" },
  { icon: Bell, path: "/notifications", label: "Notifications" },
];

export const DesktopNav = () => {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { profile, signOut } = useAuth();

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
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
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
