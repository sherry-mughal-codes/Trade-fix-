"use client";

import { Menu, PlusCircle, CreditCard, BarChart, BookOpen, ChevronDown, User, LogOut, Building2 } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Sidebar from "./Sidebar";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigationLoader } from "@/components/providers/navigation-provider";
import { clearOrganizationSwitch } from "@/app/(dashboard)/orgs/actions";

export default function Header() {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const { resolvedTheme } = useTheme();
  const { startNavigation } = useNavigationLoader();
  const pathname = usePathname();
  const [companyBranding, setCompanyBranding] = useState<{
    companyName: string | null;
    logoUrl: string | null;
    lightLogoUrl: string | null;
  } | null>(null);

  const [permissionContext, setPermissionContext] = useState<{
    isAuthenticated: boolean;
    isSuperadmin: boolean;
    permissions: string[];
    activeOrganizationName: string | null;
    activeOrganizationId: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!session?.user?.id) {
      setPermissionContext(null);
      return;
    }
    fetch("/api/me/permissions", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setPermissionContext(null);
          return;
        }
        setPermissionContext({
          isAuthenticated: !!data.isAuthenticated,
          isSuperadmin: !!data.isSuperadmin,
          permissions: Array.isArray(data.permissions) ? data.permissions : [],
          activeOrganizationName: data.activeOrganizationName || null,
          activeOrganizationId: data.activeOrganizationId || null,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setPermissionContext(null);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, pathname]);

  useEffect(() => {
    let cancelled = false;
    if (!session?.user?.id) {
      setCompanyBranding(null);
      return;
    }

    fetch("/api/settings", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setCompanyBranding(null);
          return;
        }
        setCompanyBranding({
          companyName: data.companyName || null,
          logoUrl: data.logoUrl || null,
          lightLogoUrl: data.lightLogoUrl || null,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setCompanyBranding(null);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, pathname]);

  const can = useMemo(() => {
    return (key: string) =>
      !!permissionContext?.isAuthenticated &&
      (permissionContext.isSuperadmin || permissionContext.permissions.includes(key));
  }, [permissionContext]);

  const canCreateInvoice = can("invoices.create");
  const canCreatePayment = can("payments.create");
  const canAccessReports = can("reports.access");
  const canReceivableSummary = canAccessReports && can("reports.receivableSummary");
  const canGeneralLedger = canAccessReports && can("reports.generalLedger");
  const showCreateGroup = canCreateInvoice || canCreatePayment;
  const showReportsGroup = canReceivableSummary || canGeneralLedger;
  const isSwitchedOrgMode = !!permissionContext?.isSuperadmin && !!permissionContext?.activeOrganizationId;
  const goIfNeeded = (href: string) => {
    if (href !== pathname) {
      startNavigation();
    }
  };

  const displayName = session?.user?.name || session?.user?.username || session?.user?.email || "";
  const initials = (displayName || "?").trim().charAt(0).toUpperCase();
  const roleLabel = session?.user?.isSuperadmin ? "Superadmin" : session?.user?.roles?.[0]?.name || "";
  const normalizeBrandAsset = (value: string | null | undefined) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  };
  const companyLogoUrl = normalizeBrandAsset(companyBranding?.logoUrl);
  const companyLightLogoUrl = normalizeBrandAsset(companyBranding?.lightLogoUrl);
  const centerLogoSrc =
    resolvedTheme === "dark"
      ? companyLightLogoUrl || companyLogoUrl || null
      : companyLogoUrl || companyLightLogoUrl || null;

  return (
    <header className="h-16 bg-white dark:bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-40 shadow-sm transition-colors duration-200 relative">
      <div className="flex items-center gap-4">
        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button className="p-2 hover:bg-accent rounded-full">
                <Menu className="h-5 w-5 text-muted-foreground" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 bg-minia-sidebar border-none w-64">
              <Sidebar
                onLinkClick={() => {
                  setOpen(false);
                }}
                isMobile={true}
              />
            </SheetContent>
          </Sheet>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <TooltipProvider>
            {canCreateInvoice ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/invoices/new" onClick={() => goIfNeeded("/invoices/new")}>
                    <button className="p-2 hover:bg-minia-primary/10 hover:text-minia-primary dark:text-muted-foreground dark:hover:text-foreground rounded-full transition-colors text-muted-foreground">
                      <PlusCircle className="h-5 w-5" />
                    </button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Add New Invoice</p>
                </TooltipContent>
              </Tooltip>
            ) : null}

            {canCreatePayment ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/payments/new" onClick={() => goIfNeeded("/payments/new")}>
                    <button className="p-2 hover:bg-minia-primary/10 hover:text-minia-primary dark:text-muted-foreground dark:hover:text-foreground rounded-full transition-colors text-muted-foreground">
                      <CreditCard className="h-5 w-5" />
                    </button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Record Payment</p>
                </TooltipContent>
              </Tooltip>
            ) : null}

            {showCreateGroup && showReportsGroup ? <div className="h-6 w-px bg-border mx-1"></div> : null}

            {canReceivableSummary ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/reports/receivable-summary" onClick={() => goIfNeeded("/reports/receivable-summary")}>
                    <button className="p-2 hover:bg-minia-primary/10 hover:text-minia-primary dark:text-muted-foreground dark:hover:text-foreground rounded-full transition-colors text-muted-foreground">
                      <BarChart className="h-5 w-5" />
                    </button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Receivables Summary</p>
                </TooltipContent>
              </Tooltip>
            ) : null}

            {canGeneralLedger ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/reports/general-ledger" onClick={() => goIfNeeded("/reports/general-ledger")}>
                    <button className="p-2 hover:bg-minia-primary/10 hover:text-minia-primary dark:text-muted-foreground dark:hover:text-foreground rounded-full transition-colors text-muted-foreground">
                      <BookOpen className="h-5 w-5" />
                    </button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>General Ledger</p>
                </TooltipContent>
              </Tooltip>
            ) : null}
          </TooltipProvider>
        </div>
      </div>

      {(centerLogoSrc || permissionContext?.activeOrganizationName || companyBranding?.companyName) ? (
        <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center px-16 sm:px-24">
          {centerLogoSrc ? (
            <img
              src={centerLogoSrc}
              alt={companyBranding?.companyName || permissionContext?.activeOrganizationName || "Company logo"}
              className="h-8 max-w-[140px] object-contain sm:h-10 sm:max-w-[220px]"
            />
          ) : (
            <div className="rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur sm:text-sm">
              <span className="max-w-[320px] truncate">
                {permissionContext?.activeOrganizationName || companyBranding?.companyName}
              </span>
            </div>
          )}
        </div>
      ) : null}

      <div className="flex items-center gap-4">
        {isSwitchedOrgMode ? (
          <form action={clearOrganizationSwitch}>
            <button className="inline-flex h-9 items-center rounded-md border border-input px-3 text-sm font-medium text-foreground hover:bg-accent">
              Back to Superadmin
            </button>
          </form>
        ) : null}
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="flex items-center gap-2 ml-2 rounded-md hover:bg-accent px-2 py-1.5 transition-colors">
              <div className="h-8 w-8 rounded-full bg-minia-primary/10 flex items-center justify-center text-minia-primary dark:text-minia-sidebar-text dark:bg-minia-sidebar-text/10 font-bold text-sm">
                {initials}
              </div>
              <div className="hidden sm:flex flex-col leading-tight text-left">
                <span className="text-sm font-medium text-foreground">{displayName || "User"}</span>
                {permissionContext?.activeOrganizationName ? (
                  <span className="text-xs text-muted-foreground">{permissionContext.activeOrganizationName}</span>
                ) : roleLabel ? (
                  <span className="text-xs text-muted-foreground">{roleLabel}</span>
                ) : null}
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground hidden sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {session?.user?.isSuperadmin && !permissionContext?.activeOrganizationId ? (
              <DropdownMenuItem asChild>
                <Link href="/orgs" className="flex items-center gap-2" onClick={() => goIfNeeded("/orgs")}>
                  <Building2 className="h-4 w-4" />
                  <span>Organizations</span>
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem asChild>
              <Link href="/profile" className="flex items-center gap-2" onClick={() => goIfNeeded("/profile")}>
                <User className="h-4 w-4" />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                signOut({ callbackUrl: "/auth/login" });
              }}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
