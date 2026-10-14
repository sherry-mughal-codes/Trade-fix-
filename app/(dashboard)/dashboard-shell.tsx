"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePermissions } from "@/lib/use-permissions";

import type { DashboardSnapshot } from "./dashboard-mock-data";
import { AgeingBars, AlertList, CompactRows, QueueColumn, SalesTrendChart, StatCard, Surface, ToneList } from "./dashboard-widgets";

type DashboardApiState = {
  dashboardConfig: Record<string, boolean>;
  salesLast12Months: Array<{ label: string; value: number }>;
  baseCurrency: string;
  widgetPermissions: Record<string, boolean>;
  canCustomize: boolean;
  snapshot: DashboardSnapshot | null;
  loaded: boolean;
};

const DEFAULT_DASHBOARD_STATE: DashboardApiState = {
  dashboardConfig: {},
  salesLast12Months: [],
  baseCurrency: "PKR",
  widgetPermissions: {},
  canCustomize: false,
  snapshot: null,
  loaded: false,
};

function moduleForHref(href: string) {
  if (href.startsWith("/customers")) return "customers";
  if (href.startsWith("/suppliers")) return "customers";
  if (href.startsWith("/invoices")) return "invoices";
  if (href.startsWith("/payments")) return "payments";
  if (href.startsWith("/inventory")) return "inventory";
  if (href.startsWith("/journal")) return "journal";
  if (href.startsWith("/reports")) return "reports";
  if (href.startsWith("/hr")) return "hr";
  return null;
}

function canUseHref(href: string, enabledModules: string[]) {
  const moduleKey = moduleForHref(href);
  return !moduleKey || enabledModules.includes(moduleKey);
}

function mentionsDisabledModule(value: unknown, enabledModules: string[]) {
  const text = JSON.stringify(value).toLowerCase();
  const disabledKeywordMap: Record<string, string[]> = {
    invoices: ["invoice", "invoices", "receivable", "receivables", "draft"],
    payments: ["payment", "payments", "receipt", "receipts", "collection", "collections", "promise", "promises"],
    inventory: ["inventory", "stock", "batch", "batches", "warehouse", "warehouses"],
    journal: ["journal", "ledger"],
    hr: ["salary", "payroll", "employee", "employees", "\"hr\"", " hr "],
  };

  return Object.entries(disabledKeywordMap).some(([moduleKey, keywords]) => {
    if (enabledModules.includes(moduleKey)) {
      return false;
    }

    return keywords.some((keyword) => text.includes(keyword));
  });
}

function filterSnapshotForModules(snapshot: DashboardSnapshot, enabledModules: string[]): DashboardSnapshot {
  const filterByHref = <T extends { href: string }>(items: T[]) =>
    items.filter((item) => canUseHref(item.href, enabledModules) && !mentionsDisabledModule(item, enabledModules));

  const filteredReceivablesHero = filterByHref(snapshot.receivables.hero);
  const filteredOverdueInvoices = filterByHref(snapshot.receivables.overdueInvoices);
  const filteredPromisesDue = filterByHref(snapshot.receivables.promisesDue);
  const hasReceivablesContent =
    filteredReceivablesHero.length > 0 ||
    filteredOverdueInvoices.length > 0 ||
    filteredPromisesDue.length > 0;

  return {
    ...snapshot,
    stats: filterByHref(snapshot.stats),
    priorities: {
      urgent: filterByHref(snapshot.priorities.urgent),
      dueToday: filterByHref(snapshot.priorities.dueToday),
      reviewReady: filterByHref(snapshot.priorities.reviewReady),
    },
    alerts: filterByHref(snapshot.alerts),
    finance: {
      summary: filterByHref(snapshot.finance.summary),
      pendingRows: filterByHref(snapshot.finance.pendingRows),
      recentCollections: filterByHref(snapshot.finance.recentCollections),
    },
    receivables: {
      hero: filteredReceivablesHero,
      ageing: hasReceivablesContent ? snapshot.receivables.ageing : [],
      overdueInvoices: filteredOverdueInvoices,
      promisesDue: filteredPromisesDue,
    },
    workload: {
      employees: filterByHref(snapshot.workload.employees),
      managers: filterByHref(snapshot.workload.managers),
    },
    attentionCustomers: filterByHref(snapshot.attentionCustomers),
    recentActivity: filterByHref(snapshot.recentActivity),
    upcomingDates: filterByHref(snapshot.upcomingDates),
  };
}

function hiddenCardClass(hidden: boolean) {
  return hidden ? "opacity-45 grayscale" : "";
}

export default function DashboardShell() {
  const { status: sessionStatus } = useSession();
  const { enabledModules } = usePermissions();

  const [dashboardState, setDashboardState] = useState<DashboardApiState>(DEFAULT_DASHBOARD_STATE);
  const [savedDashboardConfig, setSavedDashboardConfig] = useState<Record<string, boolean>>({});
  const [customizeMode, setCustomizeMode] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/dashboard", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return;
        setDashboardState({
          dashboardConfig:
            payload && typeof payload.dashboardConfig === "object" && !Array.isArray(payload.dashboardConfig)
              ? payload.dashboardConfig
              : {},
          salesLast12Months: Array.isArray(payload?.salesLast12Months) ? payload.salesLast12Months : [],
          baseCurrency: typeof payload?.baseCurrency === "string" ? payload.baseCurrency : "PKR",
          widgetPermissions:
            payload && typeof payload.widgetPermissions === "object" && !Array.isArray(payload.widgetPermissions)
              ? payload.widgetPermissions
              : {},
          canCustomize: Boolean(payload?.canCustomize),
          snapshot:
            payload && payload.snapshot && typeof payload.snapshot === "object" && !Array.isArray(payload.snapshot)
              ? payload.snapshot
              : null,
          loaded: true,
        });
        setSavedDashboardConfig(
          payload && typeof payload.dashboardConfig === "object" && !Array.isArray(payload.dashboardConfig)
            ? payload.dashboardConfig
            : {},
        );
      })
      .catch(() => {
        if (cancelled) return;
        setDashboardState({
          ...DEFAULT_DASHBOARD_STATE,
          loaded: true,
        });
        setSavedDashboardConfig({});
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const snapshot = useMemo(
    () => (dashboardState.snapshot ? filterSnapshotForModules(dashboardState.snapshot, enabledModules) : null),
    [dashboardState.snapshot, enabledModules],
  );

  if (sessionStatus === "loading" || !dashboardState.loaded) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Loading live dashboard data...</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-[156px] animate-pulse rounded-2xl border border-border bg-card/70" />
          ))}
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Live dashboard data could not be loaded.</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          The dashboard is no longer showing dummy data. Please refresh once, and if this message remains, I need to fix the live data loader on the server route.
        </div>
      </div>
    );
  }

  const showPriorityBoard =
    snapshot.priorities.urgent.length > 0 ||
    snapshot.priorities.dueToday.length > 0 ||
    snapshot.priorities.reviewReady.length > 0;
  const showAlerts = snapshot.alerts.length > 0;
  const showReceivables =
    snapshot.receivables.hero.length > 0 ||
    snapshot.receivables.overdueInvoices.length > 0 ||
    snapshot.receivables.promisesDue.length > 0;
  const showFinance =
    snapshot.finance.summary.length > 0 ||
    snapshot.finance.pendingRows.length > 0 ||
    snapshot.finance.recentCollections.length > 0;
  const showAttention = snapshot.attentionCustomers.length > 0;
  const showRecentActivity = snapshot.recentActivity.length > 0;
  const showUpcomingDates = snapshot.upcomingDates.length > 0;
  const visibleEmployeeWorkload = snapshot.workload.employees.filter((item) => !mentionsDisabledModule(item, enabledModules));
  const visibleManagerWorkload = snapshot.workload.managers.filter((item) => !mentionsDisabledModule(item, enabledModules));

  const canSeeWidget = (widgetId: string) => dashboardState.widgetPermissions[widgetId] !== false;
  const isWidgetVisible = (widgetId: string) => dashboardState.dashboardConfig[widgetId] !== false;

  const updateWidgetVisibility = (widgetId: string, nextValue: boolean) => {
    setDashboardState((current) => ({
      ...current,
      dashboardConfig: {
        ...current.dashboardConfig,
        [widgetId]: nextValue,
      },
    }));
  };

  const handleSaveCustomization = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/dashboard", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dashboardConfig: dashboardState.dashboardConfig }),
      });

      if (!response.ok) {
        throw new Error("Failed to save");
      }

      setSavedDashboardConfig(dashboardState.dashboardConfig);
      setCustomizeMode(false);
    } catch {
      setDashboardState((current) => ({
        ...current,
        dashboardConfig: savedDashboardConfig,
      }));
    } finally {
      setSaving(false);
    }
  };

  const ToggleControl = ({ widgetId }: { widgetId: string }) => {
    if (!customizeMode || !dashboardState.canCustomize || !canSeeWidget(widgetId)) return null;

    const visible = isWidgetVisible(widgetId);
    return visible ? (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-3 top-3 z-20 h-8 w-8 bg-background/90"
        onClick={() => updateWidgetVisibility(widgetId, false)}
      >
        <X className="h-4 w-4" />
      </Button>
    ) : (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="absolute right-3 top-3 z-20"
        onClick={() => updateWidgetVisibility(widgetId, true)}
      >
        ON
      </Button>
    );
  };

  const ManagedSection = ({
    widgetId,
    visibleWhen,
    title,
    eyebrow,
    description,
    children,
  }: {
    widgetId: string;
    visibleWhen: boolean;
    title: string;
    eyebrow?: string;
    description?: string;
    children: ReactNode;
  }) => {
    if (!canSeeWidget(widgetId)) return null;

    const visible = isWidgetVisible(widgetId);
    if (!customizeMode && (!visible || !visibleWhen)) return null;
    if (!visibleWhen && !customizeMode) return null;

    return (
      <div className={`relative ${hiddenCardClass(!visible)}`}>
        <ToggleControl widgetId={widgetId} />
        <div className={customizeMode ? "pointer-events-none" : ""}>
          <Surface title={title} eyebrow={eyebrow} description={description}>
            {children}
          </Surface>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">{snapshot.headerNote}</p>
        </div>

        {dashboardState.canCustomize ? (
          customizeMode ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => {
                  setDashboardState((current) => ({
                    ...current,
                    dashboardConfig: savedDashboardConfig,
                  }));
                  setCustomizeMode(false);
                }}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" disabled={saving} onClick={handleSaveCustomization}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setCustomizeMode(true)}>
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Customize
            </Button>
          )
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {snapshot.stats
          .filter((stat) => canSeeWidget(stat.id))
          .filter((stat) => customizeMode || isWidgetVisible(stat.id))
          .map((stat) => (
            <div key={stat.id} className={`relative ${hiddenCardClass(!isWidgetVisible(stat.id))}`}>
              <ToggleControl widgetId={stat.id} />
              <div className={customizeMode ? "pointer-events-none" : ""}>
                <StatCard stat={stat} />
              </div>
            </div>
          ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <ManagedSection
          widgetId="salesLast12Months"
          visibleWhen={dashboardState.salesLast12Months.length > 0 || customizeMode}
          title="Sales Trend"
          eyebrow="Last 12 Months"
          description="Finalized sales invoices only. Draft and cancelled invoices are excluded from this view."
        >
          {dashboardState.salesLast12Months.length > 0 ? (
            <SalesTrendChart items={dashboardState.salesLast12Months} currency={dashboardState.baseCurrency} />
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-background/60 p-6 text-sm text-muted-foreground">
              No finalized sales invoice data is available for the last 12 months yet.
            </div>
          )}
        </ManagedSection>

        <ManagedSection
          widgetId="smartAlerts"
          visibleWhen={showAlerts || customizeMode}
          title="Smart Alerts"
          eyebrow="Exceptions"
          description="Operational exceptions that should never be buried in reports."
        >
          {showAlerts ? (
            <AlertList items={snapshot.alerts} />
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-background/60 p-6 text-sm text-muted-foreground">
              No active alerts right now.
            </div>
          )}
        </ManagedSection>
      </div>

      <ManagedSection
        widgetId="priorityBoard"
        visibleWhen={showPriorityBoard || customizeMode}
        title="Today's Priority Board"
        eyebrow="Must Do Today"
        description="The most urgent actions, due items, and review-ready work that should drive the day."
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <QueueColumn title="Urgent" icon="urgent" items={snapshot.priorities.urgent} />
          <QueueColumn title="Due Today" icon="due" items={snapshot.priorities.dueToday} />
          <QueueColumn title="Review Ready" icon="review" items={snapshot.priorities.reviewReady} />
        </div>
      </ManagedSection>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ManagedSection
          widgetId="receivablesSection"
          visibleWhen={showReceivables || customizeMode}
          title="Receivables And Collections"
          eyebrow="Cash Control"
          description="Outstanding position, ageing pressure, overdue invoices, and promises due for follow-up."
        >
          <div className="space-y-5">
            {snapshot.receivables.hero.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {snapshot.receivables.hero
                  .filter((stat) => canSeeWidget(stat.id))
                  .filter((stat) => customizeMode || isWidgetVisible(stat.id))
                  .map((stat) => (
                    <div key={stat.id} className={`relative ${hiddenCardClass(!isWidgetVisible(stat.id))}`}>
                      <ToggleControl widgetId={stat.id} />
                      <div className={customizeMode ? "pointer-events-none" : ""}>
                        <StatCard stat={stat} />
                      </div>
                    </div>
                  ))}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {snapshot.receivables.ageing.length > 0 ? (
                <div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Receivable Ageing</div>
                  <AgeingBars items={snapshot.receivables.ageing} />
                </div>
              ) : null}

              {snapshot.receivables.promisesDue.length > 0 ? (
                <div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Promises Due</div>
                  <CompactRows rows={snapshot.receivables.promisesDue} />
                </div>
              ) : null}
            </div>

            {snapshot.receivables.overdueInvoices.length > 0 ? (
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Overdue Invoices</div>
                <CompactRows rows={snapshot.receivables.overdueInvoices} />
              </div>
            ) : null}
          </div>
        </ManagedSection>

        <ManagedSection
          widgetId="financeOperations"
          visibleWhen={showFinance || customizeMode}
          title="Finance Operations"
          eyebrow="Execution"
          description="Open invoicing, payment posting, and journal work that needs completion."
        >
          <div className="space-y-5">
            {snapshot.finance.summary.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {snapshot.finance.summary
                  .filter((stat) => canSeeWidget(stat.id))
                  .filter((stat) => customizeMode || isWidgetVisible(stat.id))
                  .map((stat) => (
                    <div key={stat.id} className={`relative ${hiddenCardClass(!isWidgetVisible(stat.id))}`}>
                      <ToggleControl widgetId={stat.id} />
                      <div className={customizeMode ? "pointer-events-none" : ""}>
                        <StatCard stat={stat} />
                      </div>
                    </div>
                  ))}
              </div>
            ) : null}

            {snapshot.finance.pendingRows.length > 0 ? (
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Open Finance Queue</div>
                <CompactRows rows={snapshot.finance.pendingRows} />
              </div>
            ) : null}

            {snapshot.finance.recentCollections.length > 0 ? (
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Recent Collections</div>
                <CompactRows rows={snapshot.finance.recentCollections} />
              </div>
            ) : null}
          </div>
        </ManagedSection>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ManagedSection
          widgetId="teamAccountability"
          visibleWhen={visibleEmployeeWorkload.length > 0 || visibleManagerWorkload.length > 0 || customizeMode}
          title="Team Accountability"
          eyebrow="Ownership"
          description="Workload balance, overdue ownership, and who is completing work consistently."
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">By Employee</div>
              <CompactRows rows={visibleEmployeeWorkload} />
            </div>
            {snapshot.visibility.managers && visibleManagerWorkload.length > 0 ? (
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">By Manager</div>
                <CompactRows rows={visibleManagerWorkload} />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-background/60 p-4 text-sm text-muted-foreground">
                Manager summary is hidden in staff mode. This area can later be reused for pending approvals or a personal completion trend.
              </div>
            )}
          </div>
        </ManagedSection>

        <ManagedSection
          widgetId="attentionCustomersSection"
          visibleWhen={showAttention || customizeMode}
          title={snapshot.visibility.attention ? "Customers Requiring Attention" : "My Attention Queue"}
          eyebrow={snapshot.visibility.attention ? "Risk Queue" : "My Priority Customers"}
          description={
            snapshot.visibility.attention
              ? "Customers surfaced by combined risk from overdue work, receivables, and delayed follow-up."
              : "Staff mode highlights only the customers that currently require direct follow-up from the assigned owner."
          }
        >
          {showAttention ? (
            <ToneList customers={snapshot.attentionCustomers} />
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-background/60 p-6 text-sm text-muted-foreground">
              No customer needs attention right now.
            </div>
          )}
        </ManagedSection>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ManagedSection
          widgetId="recentActivity"
          visibleWhen={showRecentActivity || customizeMode}
          title="Recent Activity Feed"
          eyebrow="Latest Movement"
          description="Cross-module activity designed to confirm what changed recently and who touched it."
        >
          {showRecentActivity ? (
            <CompactRows rows={snapshot.recentActivity} />
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-background/60 p-6 text-sm text-muted-foreground">
              No recent activity to show.
            </div>
          )}
        </ManagedSection>

        <ManagedSection
          widgetId="upcomingDates"
          visibleWhen={showUpcomingDates || customizeMode}
          title="Upcoming Dates"
          eyebrow="Next 7-14 Days"
          description="Key payroll, invoicing, and collection deadlines that need protection."
        >
          {showUpcomingDates ? (
            <CompactRows rows={snapshot.upcomingDates} />
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-background/60 p-6 text-sm text-muted-foreground">
              No upcoming dates are scheduled yet.
            </div>
          )}
        </ManagedSection>
      </div>
    </div>
  );
}
