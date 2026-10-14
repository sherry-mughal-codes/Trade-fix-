"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutGrid,
  Users,
  FileText,
  CreditCard,
  Settings,
  LogOut,
  BookOpen,
  Database,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Calculator,
  Boxes,
  Building2,
  Layers3,
  Tags,
  Store,
  Receipt,
  Scroll,
  FileClock,
  Warehouse,
  Settings2
} from "lucide-react";

import { useState, useEffect, useRef } from "react";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { useSidebar } from "@/components/providers/sidebar-provider";
import { useNavigationLoader } from "@/components/providers/navigation-provider";
import { usePermissions } from "@/lib/use-permissions";
import { useTheme } from "next-themes";

// Define item types for better type safety
type SidebarItem = {
  icon: any;
  label: string;
  href?: string;
  subItems?: { label: string; href: string; icon: any }[];
};

const mainItems: SidebarItem[] = [
  { icon: LayoutGrid, label: "Dashboard", href: "/" },
  { icon: Users, label: "Customers", href: "/customers" },
  { icon: Users, label: "Suppliers", href: "/suppliers" },
  { icon: FileText, label: "Invoices", href: "/invoices" },
  { icon: CreditCard, label: "Payments", href: "/payments" },
  {
    icon: Store,
    label: "POS",
    subItems: [
      { label: "Counter", href: "/register", icon: Store },
      { label: "Bills", href: "/pos/bills", icon: Receipt },
      { label: "Refunds", href: "/pos/refunds", icon: Scroll },
      { label: "Shifts", href: "/pos/shifts", icon: FileClock },
      { label: "X-Report", href: "/pos/reports/x", icon: FileClock },
      { label: "Z-Report", href: "/pos/reports/z", icon: FileClock },
      { label: "Counters", href: "/pos/counters", icon: Warehouse },
      { label: "Profiles", href: "/pos/profiles", icon: Settings2 },
    ],
  },
  {
    icon: Boxes,
    label: "Inventory",
    subItems: [
      { label: "Overview", href: "/inventory", icon: Boxes },
      { label: "Stock Entry", href: "/inventory/stock-entry", icon: Database },
      { label: "Adjustments", href: "/inventory/adjustments", icon: Calculator },
      { label: "Batches", href: "/inventory/batches", icon: Database },
      { label: "Ledger", href: "/inventory/ledger", icon: BookOpen },
    ],
  },
  { 
    icon: Briefcase, 
    label: "HR", 
    subItems: [
        { label: "Employees", href: "/hr/employees", icon: Users },
        { label: "Process Salary", href: "/hr/salary-process", icon: Calculator },
        { label: "Salary Payments", href: "/hr/salary-payment", icon: CreditCard },
        { label: "Bulk Salary Payment", href: "/hr/salary-payment/bulk", icon: CreditCard },
    ]
  },
  { icon: BookOpen, label: "Journal", href: "/journal" },
  { icon: BarChart3, label: "Reports", href: "/reports" },
];

const otherItems: SidebarItem[] = [
  { icon: BookOpen, label: "Chart of Accounts", href: "/data-settings" },
  {
    icon: Settings,
    label: "Settings",
    subItems: [
      { label: "Company", href: "/settings", icon: Settings },
      { label: "Users", href: "/settings/users", icon: Users },
      { label: "Roles & Rights", href: "/settings/roles-rights", icon: BookOpen },
      { label: "Organizations", href: "/orgs", icon: Database },
    ],
  },
  {
    icon: Database,
    label: "Master Data",
    subItems: [
      { label: "Overview", href: "/masters", icon: Database },
      { label: "Units", href: "/masters/units", icon: Calculator },
      { label: "Categories", href: "/masters/categories", icon: Database },
      { label: "Batches", href: "/masters/batches", icon: Layers3 },
      { label: "Warehouses", href: "/masters/warehouses", icon: Building2 },
      { label: "Price Lists", href: "/masters/price-lists", icon: Tags },
      { label: "Items", href: "/items", icon: Boxes },
    ],
  },
];

interface SidebarProps {
  onLinkClick?: () => void;
  isMobile?: boolean;
}

export default function Sidebar({ onLinkClick, isMobile = false }: SidebarProps) {
  const pathname = usePathname();
  const { has, hasModule, isSuperadmin, activeOrganizationId, loading: permissionsLoading } = usePermissions();
  const { resolvedTheme } = useTheme();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [companyBranding, setCompanyBranding] = useState<{
    companyName: string | null;
    logoUrl: string | null;
    lightLogoUrl: string | null;
    iconUrl: string | null;
    darkIconUrl: string | null;
  } | null>(null);
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { startNavigation } = useNavigationLoader();
  const inSuperadminLanding = isSuperadmin && !activeOrganizationId;

  // State for expandable sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    "POS": false,
    "Inventory": false,
    "HR": false,
    "Settings": false,
    "Master Data": false,
  });
  
  // Track if sidebar was temporarily expanded by hover interaction
  const [isTemporarilyExpanded, setIsTemporarilyExpanded] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Auto-expand section if current path is inside it
  useEffect(() => {
    if (pathname?.startsWith("/pos") || pathname === "/register") {
      setExpandedSections(prev => ({ ...prev, "POS": true }));
    } else {
      setExpandedSections(prev => ({ ...prev, "POS": false }));
    }

    if (pathname?.startsWith("/inventory")) {
        setExpandedSections(prev => ({ ...prev, "Inventory": true }));
    } else {
        setExpandedSections(prev => ({ ...prev, "Inventory": false }));
    }

    if (pathname?.startsWith("/hr")) {
        setExpandedSections(prev => ({ ...prev, "HR": true }));
    } else {
        // Auto-collapse if navigating away from HR
        setExpandedSections(prev => ({ ...prev, "HR": false }));
    }

    if (pathname?.startsWith("/settings")) {
      setExpandedSections(prev => ({ ...prev, "Settings": true }));
    } else {
      setExpandedSections(prev => ({ ...prev, "Settings": false }));
    }

    if (pathname?.startsWith("/masters") || pathname?.startsWith("/items")) {
      setExpandedSections(prev => ({ ...prev, "Master Data": true }));
    } else {
      setExpandedSections(prev => ({ ...prev, "Master Data": false }));
    }
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;

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
          iconUrl: data.iconUrl || null,
          darkIconUrl: data.darkIconUrl || null,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setCompanyBranding(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const normalizeHref = (href?: string) => href?.split("?")[0];
  const normalizeBrandAsset = (value: string | null | undefined) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  };
  const companyLogoUrl = normalizeBrandAsset(companyBranding?.logoUrl);
  const companyLightLogoUrl = normalizeBrandAsset(companyBranding?.lightLogoUrl);
  const companyIconUrl = normalizeBrandAsset(companyBranding?.iconUrl);
  const companyDarkIconUrl = normalizeBrandAsset(companyBranding?.darkIconUrl);
  const sidebarLogoSrc =
    resolvedTheme === "dark"
      ? companyLightLogoUrl || companyLogoUrl || null
      : companyLogoUrl || companyLightLogoUrl || null;
  const sidebarIconSrc =
    resolvedTheme === "dark"
      ? companyDarkIconUrl || companyIconUrl || sidebarLogoSrc
      : companyIconUrl || companyDarkIconUrl || sidebarLogoSrc;
  const brandLabel = companyBranding?.companyName || "TradeFix";

  const isPathActive = (href?: string) => {
    const normalizedHref = normalizeHref(href);
    return normalizedHref ? pathname === normalizedHref : false;
  };

  const canSee = (href?: string) => {
    const normalizedHref = normalizeHref(href);
    if (permissionsLoading) return false;
    if (inSuperadminLanding) {
      return normalizedHref === "/orgs";
    }
    switch (normalizedHref) {
      case "/":
        return has("dashboard.access");
      case "/customers":
        return hasModule("customers") && (has("customers.list") || has("customers.access"));
      case "/suppliers":
        return hasModule("customers") && (has("customers.list") || has("customers.access"));
      case "/invoices":
        return hasModule("invoices") && (has("invoices.list") || has("invoices.access"));
      case "/payments":
        return hasModule("payments") && (has("payments.list") || has("payments.access"));
      case "/inventory":
        return hasModule("inventory") && has("inventory.access");
      case "/inventory/stock-entry":
        return hasModule("inventory") && has("inventory.stockEntry.manage");
      case "/inventory/adjustments":
        return hasModule("inventory") && has("inventory.adjustments.manage");
      case "/inventory/batches":
        return hasModule("inventory") && has("inventory.batches.view");
      case "/inventory/ledger":
        return hasModule("inventory") && has("inventory.ledger.view");
      case "/journal":
        return hasModule("journal") && (has("journal.list") || has("journal.access"));
      case "/reports":
        return hasModule("reports") && has("reports.access");
      case "/settings":
        return has("settings.access");
      case "/settings/users":
        return has("settings.users.manage");
      case "/settings/roles-rights":
        return has("settings.rolesRights.manage");
      case "/orgs":
        return isSuperadmin && !activeOrganizationId;
      case "/masters":
        return has("settings.masters.manage") || has("settings.data.access");
      case "/masters/units":
        return has("settings.masters.manage") || has("settings.data.access");
      case "/masters/categories":
        return has("settings.masters.manage") || has("settings.data.access");
      case "/masters/batches":
        return has("settings.masters.manage") || has("settings.data.access");
      case "/masters/warehouses":
        return has("settings.masters.manage") || has("settings.data.access");
      case "/masters/price-lists":
        return has("settings.masters.manage") || has("settings.data.access");
      case "/items":
        return has("settings.masters.manage") || has("settings.data.access");
      case "/data-settings":
        return has("settings.data.access");
      case "/hr/employees":
        return hasModule("hr") && (has("hr.employees.list") || has("hr.access"));
      case "/hr/salary-process":
        return hasModule("hr") && has("hr.salary.process");
      case "/hr/salary-payment":
        return hasModule("hr") && has("hr.salary.payments");
      case "/hr/salary-payment/bulk":
        return hasModule("hr") && has("hr.salary.payments");
      case "/register":
        return hasModule("pos") && has("pos.access") && has("pos.counter.open");
      case "/pos":
        return hasModule("pos") && has("pos.access") && has("pos.counter.open");
      case "/pos/bills":
        return hasModule("pos") && (has("pos.access") || has("invoices.list"));
      case "/pos/refunds":
        return hasModule("pos") && has("pos.refund.do");
      case "/pos/shifts":
        return hasModule("pos") && (has("pos.shift.viewAll") || has("pos.shift.openSelf") || has("pos.shift.closeSelf"));
      case "/pos/reports/x":
        return hasModule("pos") && has("pos.report.xReport");
      case "/pos/reports/z":
        return hasModule("pos") && has("pos.report.zReport");
      case "/pos/counters":
        return hasModule("pos") && has("pos.profile.manage");
      case "/pos/profiles":
        return hasModule("pos") && has("pos.profile.manage");
      default:
        return true;
    }
  };

  const navigateIfNeeded = (href?: string) => {
    if (href && normalizeHref(href) !== pathname) {
      startNavigation();
    }
    onLinkClick?.();
  };

  const filterItems = (items: SidebarItem[]) => {
    if (permissionsLoading) return [] as SidebarItem[];
    return items
      .map((item) => {
        if (item.subItems?.length) {
          const subItems = item.subItems.filter((s) => canSee(s.href));
          if (item.label === "Settings" && !activeOrganizationId && !isSuperadmin) {
            return { ...item, subItems: [] };
          }
          return { ...item, subItems };
        }
        return item;
      })
      .filter((item) => {
        if ("subItems" in item) return (item.subItems?.length || 0) > 0;
        return canSee(item.href);
      });
  };

  const visibleMainItems = filterItems(mainItems);
  const visibleOtherItems = filterItems(otherItems);

  const toggleSection = (label: string) => {
    // If sidebar is collapsed and not mobile, expand it first
    if (isCollapsed && !isMobile) {
        toggleSidebar(); 
        setIsTemporarilyExpanded(true); // Mark as temporarily expanded
        setExpandedSections(prev => ({ ...prev, [label]: true }));
    } else {
        setExpandedSections(prev => ({ ...prev, [label]: !prev[label] }));
    }
  };

  // Handle mouse leave to auto-collapse if it was temporarily expanded
  const handleMouseLeave = () => {
    if (isTemporarilyExpanded && !isMobile && !isCollapsed) {
        toggleSidebar(); // Collapse it back
        setIsTemporarilyExpanded(false);
        // Optionally collapse the section too if desired, but keeping it expanded might be better UX?
        // Let's collapse the section too to return to clean state
        setExpandedSections(prev => ({ ...prev, "Inventory": false, "HR": false, "Settings": false, "Master Data": false })); 
    }
  };

  const toggleCollapse = () => {
    toggleSidebar();
    // If user manually toggles, reset temporary state
    setIsTemporarilyExpanded(false);
  };

  const handleLogout = () => {
    window.location.href = "/auth/login";
  };

  return (
    <>
      <div 
        ref={sidebarRef}
        onMouseLeave={handleMouseLeave}
        className={cn(
            "flex flex-col h-full bg-white dark:bg-card border-r border-gray-200 dark:border-border text-gray-600 dark:text-gray-400 transition-all duration-300 ease-in-out relative",
            !isMobile && isCollapsed ? "w-16" : "w-64" 
        )}
      >
        {/* Collapse Button (Desktop Only) */}
        {!isMobile && (
            <button
                onClick={toggleCollapse}
                className="absolute -right-3 top-20 bg-white dark:bg-card border border-gray-200 dark:border-border rounded-full p-1 shadow-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 z-10"
            >
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
        )}

        {/* Logo Area */}
        <div className={cn(
            "h-16 flex items-center border-b border-gray-100 dark:border-border",
            !isMobile && isCollapsed ? "justify-center px-2" : "justify-center px-4"
        )}>
          {(!isMobile && isCollapsed) ? (
             <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
                {sidebarIconSrc ? (
                  <img
                    src={sidebarIconSrc}
                    alt={brandLabel}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                )}
             </div>
          ) : (
            sidebarLogoSrc ? (
              <img
                src={sidebarLogoSrc}
                alt={brandLabel}
                className="max-h-10 w-auto max-w-[150px] object-contain"
              />
            ) : (
              <div className="rounded-full border border-border bg-background px-3 py-1.5 text-sm font-semibold text-foreground">
                {brandLabel}
              </div>
            )
          )}
        </div>

        {/* Navigation */}
        <div className="flex-1 py-6 overflow-y-auto overflow-x-hidden">
          {/* Main Menu */}
          <nav className="space-y-1 px-3">
              {(!isMobile && isCollapsed) ? (
                 <div className="h-4 mb-4"></div> 
              ) : (
                 <p className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4 transition-opacity duration-200">Menu</p>
              )}
              
            {visibleMainItems.map((item) => {
              const Icon = item.icon;
              const hasSubItems = item.subItems && item.subItems.length > 0;
              // Check if any sub-item is active
              const isSubItemActive = hasSubItems && item.subItems?.some(sub => isPathActive(sub.href));
              const isActive = isPathActive(item.href) || isSubItemActive;
              const isExpanded = expandedSections[item.label];
              
              return (
                <div key={item.label}>
                    {hasSubItems ? (
                        // Expandable Parent Item
                        <button
                            onClick={() => toggleSection(item.label)}
                            title={isCollapsed ? item.label : undefined}
                            className={cn(
                                "w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-md transition-colors duration-200 group",
                                isActive && !isExpanded
                                ? "bg-minia-primary/10 text-minia-primary dark:text-minia-primary"
                                : "hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200",
                                (!isMobile && isCollapsed) && "justify-center px-0"
                            )}
                        >
                             <div className="flex items-center">
                                <Icon className={cn(
                                    "h-5 w-5 flex-shrink-0", 
                                    isActive ? "text-minia-primary" : "text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300",
                                    (!isMobile && !isCollapsed) && "mr-3"
                                )} />
                                {(!isMobile && isCollapsed) ? null : (
                                    <span className="truncate">{item.label}</span>
                                )}
                             </div>
                             {(!isMobile && !isCollapsed) && (
                                 isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />
                             )}
                        </button>
                    ) : (
                        // Standard Single Item
                        <Link
                            href={item.href || "#"}
                            onClick={() => navigateIfNeeded(item.href)}
                            title={isCollapsed ? item.label : undefined}
                            className={cn(
                                "flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors duration-200 group",
                                isActive
                                ? "bg-minia-primary/10 text-minia-primary dark:text-minia-primary"
                                : "hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200",
                                (!isMobile && isCollapsed) && "justify-center px-0"
                            )}
                        >
                        <Icon className={cn(
                            "h-5 w-5 flex-shrink-0", 
                            isActive ? "text-minia-primary" : "text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300",
                            (!isMobile && !isCollapsed) && "mr-3"
                        )} />
                        {(!isMobile && isCollapsed) ? null : (
                            <span className="truncate">{item.label}</span>
                        )}
                        </Link>
                    )}

                    {/* Sub Items Render */}
                    {hasSubItems && isExpanded && !isCollapsed && (
                        <div className="mt-1 ml-4 space-y-1 border-l-2 border-gray-100 dark:border-gray-800 pl-2">
                            {item.subItems?.map((subItem) => {
                                const SubIcon = subItem.icon;
                                const isSubActive = isPathActive(subItem.href);
                                return (
                                    <Link
                                        key={subItem.href}
                                        href={subItem.href}
                                        onClick={() => navigateIfNeeded(subItem.href)}
                                        className={cn(
                                            "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200",
                                            isSubActive
                                            ? "text-minia-primary bg-minia-primary/5"
                                            : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                                        )}
                                    >
                                        <SubIcon className={cn(
                                            "h-4 w-4 flex-shrink-0 mr-2",
                                            isSubActive ? "text-minia-primary" : "text-gray-400"
                                        )} />
                                        <span className="truncate">{subItem.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
              );
            })}
          </nav>

          {/* Divider */}
          <div className="my-6 border-t border-gray-100 dark:border-border mx-3"></div>

          {/* Others Menu */}
          <nav className="space-y-1 px-3">
             {(!isMobile && isCollapsed) ? (
                 <div className="h-4 mb-4"></div>
              ) : (
                 <p className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4 transition-opacity duration-200">Others</p>
              )}
            
            {visibleOtherItems.map((item) => {
              const Icon = item.icon;
              const hasSubItems = item.subItems && item.subItems.length > 0;
              const isSubItemActive = hasSubItems && item.subItems?.some(sub => isPathActive(sub.href));
              const isActive = isPathActive(item.href) || isSubItemActive;
              const isExpanded = expandedSections[item.label];

              return (
                <div key={item.label}>
                  {hasSubItems ? (
                    <button
                      onClick={() => toggleSection(item.label)}
                      title={isCollapsed ? item.label : undefined}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-md transition-colors duration-200 group",
                        isActive && !isExpanded
                          ? "bg-minia-primary/10 text-minia-primary dark:text-minia-primary"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200",
                        (!isMobile && isCollapsed) && "justify-center px-0"
                      )}
                    >
                      <div className="flex items-center">
                        <Icon
                          className={cn(
                            "h-5 w-5 flex-shrink-0",
                            isActive ? "text-minia-primary" : "text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300",
                            (!isMobile && !isCollapsed) && "mr-3"
                          )}
                        />
                        {(!isMobile && isCollapsed) ? null : <span className="truncate">{item.label}</span>}
                      </div>
                      {(!isMobile && !isCollapsed) && (
                        isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  ) : (
                    <Link
                      key={item.href}
                      href={item.href || "#"}
                      onClick={() => { startNavigation(); onLinkClick?.(); }}
                      title={isCollapsed ? item.label : undefined}
                      className={cn(
                        "flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors duration-200 group",
                        isActive
                          ? "bg-minia-primary/10 text-minia-primary dark:text-minia-primary"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200",
                        (!isMobile && isCollapsed) && "justify-center px-0"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-5 w-5 flex-shrink-0",
                          isActive ? "text-minia-primary" : "text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300",
                          (!isMobile && !isCollapsed) && "mr-3"
                        )}
                      />
                      {(!isMobile && isCollapsed) ? null : <span className="truncate">{item.label}</span>}
                    </Link>
                  )}

                  {hasSubItems && isExpanded && !isCollapsed && (
                    <div className="mt-1 ml-4 space-y-1 border-l-2 border-gray-100 dark:border-gray-800 pl-2">
                      {item.subItems?.map((subItem) => {
                        const SubIcon = subItem.icon;
                        const isSubActive = isPathActive(subItem.href);
                        return (
                          <Link
                            key={subItem.href}
                            href={subItem.href}
                            onClick={() => { startNavigation(); onLinkClick?.(); }}
                            className={cn(
                              "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200",
                              isSubActive
                                ? "text-minia-primary bg-minia-primary/5"
                                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                            )}
                          >
                            <SubIcon
                              className={cn(
                                "h-4 w-4 flex-shrink-0 mr-2",
                                isSubActive ? "text-minia-primary" : "text-gray-400"
                              )}
                            />
                            <span className="truncate">{subItem.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Footer / Logout */}
        <div className="p-4 border-t border-gray-100 dark:border-border">
          <button 
            onClick={() => setShowLogoutConfirm(true)}
            title={isCollapsed ? "Logout" : undefined}
            className={cn(
                "flex items-center w-full px-3 py-2 text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all border border-transparent hover:border-red-200 dark:hover:border-red-800",
                (!isMobile && isCollapsed) && "justify-center px-0",
                "border-red-100 dark:border-red-900/30 text-red-500 bg-red-50/50 dark:bg-red-900/10" 
            )}
          >
            <LogOut className={cn(
                "h-5 w-5 text-red-500 flex-shrink-0",
                (!isMobile && !isCollapsed) && "mr-3"
            )} />
            {(!isMobile && isCollapsed) ? null : (
                <span className="truncate">Logout</span>
            )}
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Logout"
        message="Are you sure you want to logout from the application?"
        confirmText="Logout"
        cancelText="Cancel"
        type="danger"
      />
    </>
  );
}
