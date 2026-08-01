import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { MobileNav } from "./MobileNav";
import { MobileTopHeader } from "./MobileTopHeader";
import { DesktopNav } from "./DesktopNav";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
  const location = useLocation();
  // MobileTopHeader only renders on the feed — everywhere else the top offset
  // must be removed, otherwise a 64px empty gap sits above the page header.
  const hasMobileTopHeader =
    location.pathname === "/" || location.pathname === "/feed";

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background overflow-x-hidden">
      <DesktopNav />
      <MobileTopHeader />

      {/* Main Content */}
      <main
        className={cn(
          "pb-20 md:pt-0 md:ml-64 md:pb-0 lg:ml-72 transition-all duration-300",
          hasMobileTopHeader && "pt-16"
        )}
      >
        <div className="mx-auto max-w-2xl px-4 pt-1 pb-4 md:py-6 w-full">
          {children}
        </div>
      </main>

      <MobileNav />
    </div>
  );
};

