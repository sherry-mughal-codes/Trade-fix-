"use client";

import { useSidebar } from "@/components/providers/sidebar-provider";
import { useNavigationLoader } from "@/components/providers/navigation-provider";
import { cn } from "@/lib/utils";
import Header from "@/components/layout/Header";

export default function MainContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar();
  const { isNavigating } = useNavigationLoader();

  return (
    <div className={cn("flex-1 min-w-0 flex flex-col transition-all duration-300 ease-in-out", isCollapsed ? "md:pl-16" : "md:pl-64")}>
      <Header />
      <main className="flex-1 min-w-0 p-6 bg-background relative">
        {isNavigating ? (
          <div className="absolute inset-0 z-40 bg-background/60 backdrop-blur-[1px] flex items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
              Loading…
            </div>
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
