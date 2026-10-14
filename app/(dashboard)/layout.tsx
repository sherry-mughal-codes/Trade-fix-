import Sidebar from "@/components/layout/Sidebar";
import MainContent from "@/components/layout/main-content";
import { SidebarProvider } from "@/components/providers/sidebar-provider";
import { NavigationProvider } from "@/components/providers/navigation-provider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <NavigationProvider>
        <div className="flex min-h-screen">
          <div className="hidden md:flex flex-col fixed inset-y-0 z-50">
            <Sidebar />
          </div>

          <MainContent>{children}</MainContent>
        </div>
      </NavigationProvider>
    </SidebarProvider>
  );
}
