import { ReactNode } from "react";
import { MobileNav } from "./MobileNav";
import { MobileTopHeader } from "./MobileTopHeader";
import { DesktopNav } from "./DesktopNav";

interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <DesktopNav />
      <MobileTopHeader />
      
      {/* Main Content */}
      <main className="pb-20 pt-16 md:pt-0 md:ml-64 md:pb-0 lg:ml-72">
        <div className="mx-auto max-w-2xl px-4 py-4 md:py-6">
          {children}
        </div>
      </main>

      <MobileNav />
    </div>
  );
};
