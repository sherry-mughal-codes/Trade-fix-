import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getPermissionContext } from "@/lib/rbac";
import { requireOrganizationContext } from "@/lib/tenancy";
import type {
  AgeingBucket,
  AlertItem,
  AttentionCustomer,
  DashboardSnapshot,
  DashboardStat,
  DashboardTableRow,
  QueueItem,
  RoleView,
  Tone,
} from "@/app/(dashboard)/dashboard-mock-data";

export const dynamic = "force-dynamic";

const WIDGET_PERMISSION_MAP: Record<string, string> = {
  customers: "dashboard.card.activeCustomers",
  drafts: "dashboard.card.draftInvoices",
  "invoices-due": "dashboard.card.invoicesDueToday",
  receivables: "dashboard.card.outstandingReceivables",
  payments: "dashboard.card.paymentsThisMonth",
  journal: "dashboard.card.journalEntries",
  employees: "dashboard.card.activeEmployees",
  salary: "dashboard.card.salaryPayables",
  "customers-risk": "dashboard.card.highRiskCustomers",
  "my-open": "dashboard.card.myOpenItems",
  priorityBoard: "dashboard.section.priorityBoard",
  smartAlerts: "dashboard.section.smartAlerts",
  receivablesSection: "dashboard.section.receivables",
  financeOperations: "dashboard.section.financeOperations",
  teamAccountability: "dashboard.section.teamAccountability",
  attentionCustomersSection: "dashboard.section.attentionCustomers",
  recentActivity: "dashboard.section.recentActivity",
  upcomingDates: "dashboard.section.upcomingDates",
  salesLast12Months: "dashboard.chart.salesLast12Months",
};

type PaymentRecord = {
  id: string;
  paymentNumber: string;
  date: Date;
  type: string;
  amount: number;
  journalEntryId: string | null;
  createdAt: Date;
  party: { id: string; name: string };
  invoiceId: string | null;
};

type InvoiceRecord = {
  id: string;
  invoiceNumber: string;
  type: string;
  status: string;
  date: Date;
  dueDate: Date | null;
  baseGrandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  createdAt: Date;
  party: {
    id: string;
    name: string;
    currency: string;
    creditLimit: number;
  };
  paymentPromises: Array<{
    id: string;
    promisedDate: Date;
    promisedAmount: number | null;
    status: string;
  }>;
};

type SalarySlipRecord = {
  id: string;
  month: number;
  year: number;
  finalPayableAmount: number;
  payableAmount: number;
  status: string;
  createdAt: Date;
  employee: { id: string; name: string };
};

type SalaryPaymentRecord = {
  id: string;
  date: Date;
  amount: number;
  status: string;
  createdAt: Date;
  employee: { id: string; name: string };
};

function parseDashboardConfig(value: unknown): Record<string, boolean> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return parseDashboardConfig(JSON.parse(value));
    } catch {
      return {};
    }
  }
  if (typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[0] === "string" && typeof entry[1] === "boolean"),
  );
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfPreviousMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1);
}

function endOfPreviousMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 0, 23, 59, 59, 999);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function formatCurrency(value: number, currency: string) {
  return `${currency} ${Math.round(Number(value || 0)).toLocaleString()}`;
}

function formatCompactCurrency(value: number, currency: string) {
  const absolute = Math.abs(Number(value || 0));
  if (absolute >= 1_000_000) {
    return `${currency} ${(value / 1_000_000).toFixed(2).replace(/\.00$/, "")}M`;
  }
  if (absolute >= 1_000) {
    return `${currency} ${(value / 1_000).toFixed(0)}K`;
  }
  return `${currency} ${Math.round(value).toLocaleString()}`;
}

function formatPercentDelta(current: number, previous: number) {
  if (!previous && !current) return "No change";
  if (!previous) return "New activity";
  const delta = ((current - previous) / previous) * 100;
  const prefix = delta >= 0 ? "+" : "";
  return `${prefix}${delta.toFixed(0)}% vs last month`;
}

function formatCountDelta(current: number, previous: number, suffix: string) {
  const delta = current - previous;
  if (delta === 0) return `Same as last ${suffix}`;
  return `${delta > 0 ? "+" : ""}${delta} vs last ${suffix}`;
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatRelativeLabel(date: Date, today: Date) {
  const dayMs = 1000 * 60 * 60 * 24;
  const diff = Math.round((startOfDay(date).getTime() - startOfDay(today).getTime()) / dayMs);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1) return `In ${diff} days`;
  return `${Math.abs(diff)} days ago`;
}

function daysPastDue(dueDate: Date | null, today: Date) {
  if (!dueDate) return 0;
  const dayMs = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.floor((startOfDay(today).getTime() - startOfDay(dueDate).getTime()) / dayMs));
}

function resolveToneFromOverdue(days: number): Tone {
  if (days >= 15) return "danger";
  if (days > 0) return "warning";
  return "primary";
}

function normalizeStatus(value: string | null | undefined) {
  const normalized = String(value || "").trim().toUpperCase();

  // Keep legacy records readable in the current workflow language.
  if (normalized === "POSTED") return "SENT";

  return normalized;
}

function buildSalesTrend(invoices: Array<{ date: Date; baseGrandTotal: number }>) {
  const start = startOfMonth(addDays(new Date(), -330));
  start.setMonth(start.getMonth() - 1);
  const rangeStart = startOfMonth(addDays(new Date(), 0));
  rangeStart.setMonth(rangeStart.getMonth() - 11);

  const monthly = new Map<string, { label: string; value: number }>();
  for (let index = 0; index < 12; index += 1) {
    const point = new Date(rangeStart);
    point.setMonth(rangeStart.getMonth() + index);
    monthly.set(monthKey(point), {
      label: point.toLocaleString("default", { month: "short" }),
      value: 0,
    });
  }

  for (const invoice of invoices) {
    const key = monthKey(invoice.date);
    const bucket = monthly.get(key);
    if (!bucket) continue;
    bucket.value += Number(invoice.baseGrandTotal || 0);
  }

  return Array.from(monthly.values());
}

function buildAgeingBuckets(invoices: InvoiceRecord[], currency: string, today: Date): AgeingBucket[] {
  const buckets = [
    { label: "0-30 days", min: 0, max: 30, value: 0 },
    { label: "31-60 days", min: 31, max: 60, value: 0 },
    { label: "61-90 days", min: 61, max: 90, value: 0 },
    { label: "90+ days", min: 91, max: Number.POSITIVE_INFINITY, value: 0 },
  ];

  for (const invoice of invoices) {
    const days = daysPastDue(invoice.dueDate || invoice.date, today);
    const bucket = buckets.find((entry) => days >= entry.min && days <= entry.max);
    if (!bucket) continue;
    bucket.value += Number(invoice.balanceAmount || 0);
  }

  const total = buckets.reduce((sum, bucket) => sum + bucket.value, 0);

  return buckets.map((bucket) => ({
    label: bucket.label,
    amount: formatCurrency(bucket.value, currency),
    percentage: total > 0 ? Math.max(6, Math.round((bucket.value / total) * 100)) : 0,
  }));
}

function buildAttentionCustomers(invoices: InvoiceRecord[], currency: string, today: Date): AttentionCustomer[] {
  const grouped = new Map<
    string,
    {
      name: string;
      receivableAmount: number;
      overdueAmount: number;
      overdueInvoices: number;
      activePromises: number;
      promisesMissed: number;
      creditLimit: number;
      issues: Set<string>;
    }
  >();

  for (const invoice of invoices) {
    const partyId = invoice.party.id;
    const entry =
      grouped.get(partyId) ||
      {
        name: invoice.party.name,
        receivableAmount: 0,
        overdueAmount: 0,
        overdueInvoices: 0,
        activePromises: 0,
        promisesMissed: 0,
        creditLimit: Number(invoice.party.creditLimit || 0),
        issues: new Set<string>(),
      };

    const balance = Number(invoice.balanceAmount || 0);
    const overdueDays = daysPastDue(invoice.dueDate || invoice.date, today);
    entry.receivableAmount += balance;
    if (overdueDays > 0) {
      entry.overdueAmount += balance;
      entry.overdueInvoices += 1;
      entry.issues.add("Overdue invoice");
    }

    for (const promise of invoice.paymentPromises || []) {
      if (normalizeStatus(promise.status) !== "ACTIVE") continue;
      entry.activePromises += 1;
      entry.issues.add("Active promise");
      if (startOfDay(promise.promisedDate) < startOfDay(today)) {
        entry.promisesMissed += 1;
        entry.issues.add("Promise missed");
      }
    }

    if (entry.creditLimit > 0 && entry.receivableAmount >= entry.creditLimit * 0.8) {
      entry.issues.add("Near credit limit");
    }

    grouped.set(partyId, entry);
  }

  return Array.from(grouped.entries())
    .map(([partyId, entry]) => {
      let score = 0;
      score += Math.min(45, Math.round((entry.overdueAmount / Math.max(entry.receivableAmount, 1)) * 45));
      score += Math.min(20, entry.overdueInvoices * 7);
      score += Math.min(20, entry.promisesMissed * 10 + entry.activePromises * 4);
      if (entry.creditLimit > 0 && entry.receivableAmount >= entry.creditLimit) {
        score += 15;
      } else if (entry.creditLimit > 0 && entry.receivableAmount >= entry.creditLimit * 0.8) {
        score += 8;
      }

      const issues = Array.from(entry.issues);
      return {
        id: partyId,
        customer: entry.name,
        riskScore: Math.min(99, Math.max(40, score)),
        issues: issues.length > 0 ? issues.slice(0, 3) : ["Open receivable follow-up"],
        receivableAmount: formatCurrency(entry.receivableAmount, currency),
        nextAction:
          entry.promisesMissed > 0
            ? "Escalate missed promise and confirm next payment date"
            : entry.overdueInvoices > 0
              ? "Review overdue invoices and update collection follow-up"
              : "Check open exposure and confirm next action",
        href: "/customers",
      } satisfies AttentionCustomer;
    })
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5);
}

function buildRecentActivityRows(args: {
  recentInvoices: Array<{ id: string; invoiceNumber: string; type: string; status: string; createdAt: Date; party: { name: string } }>;
  recentPayments: PaymentRecord[];
  recentJournals: Array<{ id: string; entryNumber: string; description: string | null; createdAt: Date }>;
  recentSalaryPayments: SalaryPaymentRecord[];
  today: Date;
}): DashboardTableRow[] {
  const rows: Array<{ sortAt: Date; row: DashboardTableRow }> = [];

  for (const invoice of args.recentInvoices) {
    rows.push({
      sortAt: invoice.createdAt,
      row: {
        id: `invoice-${invoice.id}`,
        primary: `${invoice.type === "PURCHASE" ? "Purchase" : "Sales"} invoice ${invoice.invoiceNumber}`,
        secondary: `${invoice.party.name} • ${normalizeStatus(invoice.status) || "DRAFT"}`,
        tertiary: "Invoices",
        meta: formatRelativeLabel(invoice.createdAt, args.today),
        tone: normalizeStatus(invoice.status) === "DRAFT" ? "warning" : "primary",
        href: "/invoices",
      },
    });
  }

  for (const payment of args.recentPayments) {
    rows.push({
      sortAt: payment.createdAt,
      row: {
        id: `payment-${payment.id}`,
        primary: `${payment.type === "PAY" ? "Supplier payment" : "Receipt"} ${payment.paymentNumber}`,
        secondary: `${payment.party.name} • ${Math.round(payment.amount).toLocaleString()}`,
        tertiary: "Payments",
        meta: formatRelativeLabel(payment.createdAt, args.today),
        tone: payment.type === "PAY" ? "primary" : "success",
        href: "/payments",
      },
    });
  }

  for (const journal of args.recentJournals) {
    rows.push({
      sortAt: journal.createdAt,
      row: {
        id: `journal-${journal.id}`,
        primary: `Journal ${journal.entryNumber}`,
        secondary: journal.description || "Journal entry posted",
        tertiary: "Journal",
        meta: formatRelativeLabel(journal.createdAt, args.today),
        tone: "primary",
        href: "/journal",
      },
    });
  }

  for (const salaryPayment of args.recentSalaryPayments) {
    rows.push({
      sortAt: salaryPayment.createdAt,
      row: {
        id: `salary-payment-${salaryPayment.id}`,
        primary: `Salary payment for ${salaryPayment.employee.name}`,
        secondary: `${Math.round(salaryPayment.amount).toLocaleString()} released`,
        tertiary: "HR",
        meta: formatRelativeLabel(salaryPayment.createdAt, args.today),
        tone: "success",
        href: "/hr/salary-payment",
      },
    });
  }

  return rows
    .sort((a, b) => b.sortAt.getTime() - a.sortAt.getTime())
    .slice(0, 6)
    .map((entry) => entry.row);
}

function buildUpcomingRows(args: {
  dueTodayInvoices: InvoiceRecord[];
  overdueInvoices: InvoiceRecord[];
  activePromises: Array<{
    id: string;
    promisedDate: Date;
    promisedAmount: number | null;
    invoice: { invoiceNumber: string; party: { name: string } };
  }>;
  upcomingSalaryPayments: SalaryPaymentRecord[];
  today: Date;
  currency: string;
}): DashboardTableRow[] {
  const rows: Array<{ sortAt: Date; row: DashboardTableRow }> = [];

  for (const invoice of args.dueTodayInvoices) {
    rows.push({
      sortAt: invoice.dueDate || invoice.date,
      row: {
        id: `due-invoice-${invoice.id}`,
        primary: formatDateLabel(invoice.dueDate || invoice.date),
        secondary: `${invoice.party.name} invoice due`,
        tertiary: invoice.invoiceNumber,
        meta: "Invoices",
        tone: "warning",
        href: "/invoices",
      },
    });
  }

  for (const promise of args.activePromises) {
    rows.push({
      sortAt: promise.promisedDate,
      row: {
        id: `promise-${promise.id}`,
        primary: formatDateLabel(promise.promisedDate),
        secondary: `${promise.invoice.party.name} promise date`,
        tertiary: promise.promisedAmount ? formatCompactCurrency(promise.promisedAmount, args.currency) : promise.invoice.invoiceNumber,
        meta: "Payments",
        tone: startOfDay(promise.promisedDate) <= startOfDay(args.today) ? "warning" : "primary",
        href: "/payments",
      },
    });
  }

  for (const payment of args.upcomingSalaryPayments) {
    rows.push({
      sortAt: payment.date,
      row: {
        id: `salary-due-${payment.id}`,
        primary: formatDateLabel(payment.date),
        secondary: `Salary payment for ${payment.employee.name}`,
        tertiary: formatCompactCurrency(payment.amount, args.currency),
        meta: "HR",
        tone: "warning",
        href: "/hr/salary-payment",
      },
    });
  }

  for (const invoice of args.overdueInvoices.slice(0, 3)) {
    rows.push({
      sortAt: invoice.dueDate || invoice.date,
      row: {
        id: `overdue-upcoming-${invoice.id}`,
        primary: formatDateLabel(invoice.dueDate || invoice.date),
        secondary: `${invoice.party.name} overdue invoice`,
        tertiary: invoice.invoiceNumber,
        meta: "Collections",
        tone: "danger",
        href: "/invoices",
      },
    });
  }

  return rows
    .sort((a, b) => a.sortAt.getTime() - b.sortAt.getTime())
    .slice(0, 6)
    .map((entry) => entry.row);
}

async function getCustomizationAccess(userId: string | null, organizationId: string, permissions: string[], isSuperadmin: boolean) {
  if (isSuperadmin || permissions.includes("dashboard.customize")) return true;
  if (!userId) return false;

  const membership = await prisma.organizationMembership.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    select: { isOwner: true, isActive: true },
  });

  return Boolean(membership?.isActive && membership.isOwner);
}

async function resolveRoleViewServer(userId: string | null, isSuperadmin: boolean, organizationId: string): Promise<RoleView> {
  if (isSuperadmin || !userId) return "partner";

  const userRoles = await prisma.userRole.findMany({
    where: {
      userId,
      role: {
        organizationId,
      },
    },
    select: {
      role: {
        select: { name: true },
      },
    },
  });

  const roleNames = userRoles.map((entry) => String(entry.role.name || "").toLowerCase());
  if (roleNames.some((name) => ["partner", "manager", "admin", "lead", "head", "supervisor"].some((keyword) => name.includes(keyword)))) {
    return "manager";
  }

  return "staff";
}

function buildWidgetPermissions(permissionCtx: Awaited<ReturnType<typeof getPermissionContext>>) {
  const specificPermissionKeys = Array.from(new Set(Object.values(WIDGET_PERMISSION_MAP)));
  const hasAnySpecificDashboardPermission =
    permissionCtx.isSuperadmin || specificPermissionKeys.some((key) => permissionCtx.permissions.includes(key));
  const hasDashboardAccess = permissionCtx.isSuperadmin || permissionCtx.permissions.includes("dashboard.access");

  return Object.fromEntries(
    Object.entries(WIDGET_PERMISSION_MAP).map(([widgetId, permissionKey]) => [
      widgetId,
      permissionCtx.isSuperadmin ||
        permissionCtx.permissions.includes(permissionKey) ||
        (hasDashboardAccess && !hasAnySpecificDashboardPermission),
    ]),
  );
}

function buildSnapshot(args: {
  role: RoleView;
  currency: string;
  today: Date;
  activeCustomersCount: number;
  draftInvoices: InvoiceRecord[];
  dueTodayInvoices: InvoiceRecord[];
  openSalesInvoices: InvoiceRecord[];
  overdueInvoices: InvoiceRecord[];
  attentionCustomers: AttentionCustomer[];
  receivePaymentsThisMonth: number;
  receivePaymentsLastMonth: number;
  receivePaymentsThisWeek: number;
  journalThisMonth: number;
  journalLastMonth: number;
  activeEmployeesCount: number;
  openSalarySlips: SalarySlipRecord[];
  salaryOutstandingAmount: number;
  paymentsToPost: PaymentRecord[];
  recentReceivePayments: PaymentRecord[];
  promisesDueToday: Array<{
    id: string;
    promisedDate: Date;
    promisedAmount: number | null;
    invoice: { id: string; invoiceNumber: string; party: { name: string } };
  }>;
  activePromises: Array<{
    id: string;
    promisedDate: Date;
    promisedAmount: number | null;
    invoice: { id: string; invoiceNumber: string; party: { name: string } };
  }>;
  recentActivity: DashboardTableRow[];
  upcomingDates: DashboardTableRow[];
  recentJournals: Array<{ id: string; entryNumber: string; description: string | null; createdAt: Date }>;
}): DashboardSnapshot {
  const outstandingReceivables = args.openSalesInvoices.reduce((sum, invoice) => sum + Number(invoice.balanceAmount || 0), 0);
  const overdueAmount = args.overdueInvoices.reduce((sum, invoice) => sum + Number(invoice.balanceAmount || 0), 0);
  const highRiskCustomers = args.attentionCustomers.filter((customer) => customer.riskScore >= 75).length;
  const reviewReadyCount = args.draftInvoices.length + args.paymentsToPost.length + args.openSalarySlips.length;
  const openActionCount =
    args.draftInvoices.length + args.overdueInvoices.length + args.promisesDueToday.length + args.paymentsToPost.length;

  const commonHeaderNote =
    args.role === "staff"
      ? "Built from live organization activity to show the current queues, due dates, and finance follow-up that need attention."
      : args.role === "manager"
        ? "Built from live organization activity to control deadlines, receivables, payroll movement, and review-ready finance work."
        : "Built from live organization activity to review financial health, collections pressure, payroll movement, and customer risk at a glance.";

  const statsByRole: Record<RoleView, DashboardStat[]> = {
    partner: [
      {
        id: "customers",
        label: "Active Customers",
        value: String(args.activeCustomersCount),
        delta: `${highRiskCustomers} high risk`,
        caption: "Customer accounts currently enabled for invoicing and collections",
        tone: highRiskCustomers > 0 ? "warning" : "primary",
        href: "/customers",
      },
      {
        id: "drafts",
        label: "Draft Invoices",
        value: String(args.draftInvoices.length),
        delta: reviewReadyCount > 0 ? `${reviewReadyCount} review items` : "Nothing pending",
        caption: "Current invoices waiting review or send action",
        tone: args.draftInvoices.length > 0 ? "warning" : "success",
        href: "/invoices",
      },
      {
        id: "invoices-due",
        label: "Invoices Due Today",
        value: String(args.dueTodayInvoices.length),
        delta: formatCompactCurrency(
          args.dueTodayInvoices.reduce((sum, invoice) => sum + Number(invoice.balanceAmount || 0), 0),
          args.currency,
        ),
        caption: "Sales invoices that require collection movement today",
        tone: args.dueTodayInvoices.length > 0 ? "warning" : "primary",
        href: "/reports/invoices-due-today",
      },
      {
        id: "receivables",
        label: "Outstanding Receivables",
        value: formatCompactCurrency(outstandingReceivables, args.currency),
        delta: `${formatCompactCurrency(overdueAmount, args.currency)} overdue`,
        caption: "Open sales invoice exposure across customers",
        tone: overdueAmount > 0 ? "danger" : "success",
        href: "/reports/receivable-summary",
      },
      {
        id: "payments",
        label: "Payments This Month",
        value: formatCompactCurrency(args.receivePaymentsThisMonth, args.currency),
        delta: formatPercentDelta(args.receivePaymentsThisMonth, args.receivePaymentsLastMonth),
        caption: "Customer receipts captured and posted in the current month",
        tone: args.receivePaymentsThisMonth >= args.receivePaymentsLastMonth ? "success" : "warning",
        href: "/payments",
      },
      {
        id: "journal",
        label: "Journal Entries",
        value: String(args.journalThisMonth),
        delta: formatCountDelta(args.journalThisMonth, args.journalLastMonth, "month"),
        caption: "Journal activity posted during the current month",
        tone: "primary",
        href: "/journal",
      },
      {
        id: "employees",
        label: "Active Employees",
        value: String(args.activeEmployeesCount),
        delta: `${args.openSalarySlips.length} payroll items open`,
        caption: "Employees included in the active payroll setup",
        tone: args.activeEmployeesCount > 0 ? "primary" : "neutral",
        href: "/hr/employees",
      },
      {
        id: "salary",
        label: "Salary Payables",
        value: formatCompactCurrency(args.salaryOutstandingAmount, args.currency),
        delta: `${args.openSalarySlips.length} slips open`,
        caption: "Open salary exposure still awaiting payment release",
        tone: args.salaryOutstandingAmount > 0 ? "warning" : "success",
        href: "/hr/salary-payment",
      },
    ],
    manager: [
      {
        id: "customers",
        label: "Active Customers",
        value: String(args.activeCustomersCount),
        delta: `${highRiskCustomers} high risk`,
        caption: "Customers with current receivable or invoicing activity",
        tone: highRiskCustomers > 0 ? "warning" : "primary",
        href: "/customers",
      },
      {
        id: "drafts",
        label: "Drafts For Review",
        value: String(args.draftInvoices.length),
        delta: `${reviewReadyCount} review items`,
        caption: "Draft sales and purchase invoices waiting verification",
        tone: args.draftInvoices.length > 0 ? "warning" : "success",
        href: "/invoices",
      },
      {
        id: "invoices-due",
        label: "Due Collections",
        value: String(args.dueTodayInvoices.length),
        delta: `${args.promisesDueToday.length} promises today`,
        caption: "Invoices and collection follow-ups requiring movement today",
        tone: args.dueTodayInvoices.length > 0 || args.promisesDueToday.length > 0 ? "warning" : "primary",
        href: "/payments",
      },
      {
        id: "receivables",
        label: "Receivable Exposure",
        value: formatCompactCurrency(outstandingReceivables, args.currency),
        delta: `${formatCompactCurrency(overdueAmount, args.currency)} overdue`,
        caption: "Outstanding sales exposure that needs active follow-up",
        tone: overdueAmount > 0 ? "danger" : "success",
        href: "/reports/receivable-summary",
      },
      {
        id: "payments",
        label: "Collections This Week",
        value: formatCompactCurrency(args.receivePaymentsThisWeek, args.currency),
        delta: `${args.recentReceivePayments.length} recent receipts`,
        caption: "Receipts captured during the current week",
        tone: args.receivePaymentsThisWeek > 0 ? "success" : "primary",
        href: "/payments",
      },
      {
        id: "journal",
        label: "Journals This Month",
        value: String(args.journalThisMonth),
        delta: `${args.recentJournals.length} recent`,
        caption: "Journal entries posted during the month",
        tone: "primary",
        href: "/journal",
      },
      {
        id: "customers-risk",
        label: "High-Risk Customers",
        value: String(highRiskCustomers),
        delta: `${args.attentionCustomers.length} monitored`,
        caption: "Customers requiring direct management follow-up",
        tone: highRiskCustomers > 0 ? "danger" : "success",
        href: "/customers",
      },
      {
        id: "salary",
        label: "Salary Payables",
        value: formatCompactCurrency(args.salaryOutstandingAmount, args.currency),
        delta: `${args.openSalarySlips.length} slips open`,
        caption: "Payroll movement that still needs release or closure",
        tone: args.salaryOutstandingAmount > 0 ? "warning" : "success",
        href: "/hr/salary-payment",
      },
    ],
    staff: [
      {
        id: "my-open",
        label: "Open Actions",
        value: String(openActionCount),
        delta: `${args.promisesDueToday.length + args.dueTodayInvoices.length} due today`,
        caption: "Current invoice, payment, and payroll actions still open",
        tone: openActionCount > 0 ? "warning" : "success",
        href: "/invoices",
      },
      {
        id: "my-customers",
        label: "Customer Accounts",
        value: String(args.activeCustomersCount),
        delta: `${highRiskCustomers} high risk`,
        caption: "Customer records currently active in billing and collections",
        tone: highRiskCustomers > 0 ? "warning" : "primary",
        href: "/customers",
      },
      {
        id: "my-payments",
        label: "Collections Due",
        value: String(args.promisesDueToday.length + args.activePromises.filter((promise) => startOfDay(promise.promisedDate) < startOfDay(args.today)).length),
        delta: `${args.promisesDueToday.length} due today`,
        caption: "Collection promises and receipts requiring movement",
        tone: args.promisesDueToday.length > 0 ? "warning" : "primary",
        href: "/payments",
      },
      {
        id: "my-overdue",
        label: "Overdue Invoices",
        value: String(args.overdueInvoices.length),
        delta: formatCompactCurrency(overdueAmount, args.currency),
        caption: "Sales invoices already beyond their due date",
        tone: args.overdueInvoices.length > 0 ? "danger" : "success",
        href: "/reports/due-ageing",
      },
      {
        id: "my-completed",
        label: "Collections This Week",
        value: formatCompactCurrency(args.receivePaymentsThisWeek, args.currency),
        delta: `${args.recentReceivePayments.length} recent receipts`,
        caption: "Receipts posted during the current week",
        tone: args.receivePaymentsThisWeek > 0 ? "success" : "primary",
        href: "/payments",
      },
      {
        id: "my-dates",
        label: "Upcoming Dates",
        value: String(args.upcomingDates.length),
        delta: args.upcomingDates.length > 0 ? "Next 14 days" : "No active dates",
        caption: "Invoice, promise, and payroll dates already scheduled ahead",
        tone: args.upcomingDates.length > 0 ? "primary" : "success",
        href: "/payments",
      },
      {
        id: "my-review",
        label: "Awaiting Review",
        value: String(reviewReadyCount),
        delta: `${args.draftInvoices.length} drafts`,
        caption: "Items that still need verification or posting",
        tone: reviewReadyCount > 0 ? "warning" : "success",
        href: "/invoices",
      },
      {
        id: "my-feed",
        label: "Recent Actions",
        value: String(args.recentActivity.length),
        delta: "Latest updates",
        caption: "Most recent operational movement across the organization",
        tone: "success",
        href: "/journal",
      },
    ],
  };

  const urgentItems: QueueItem[] = [
    ...args.overdueInvoices.slice(0, 2).map((invoice) => ({
      id: `urgent-overdue-${invoice.id}`,
      title: `${invoice.party.name} overdue invoice`,
      subtitle: `${invoice.invoiceNumber} • ${formatCompactCurrency(invoice.balanceAmount, args.currency)}`,
      dueLabel: `${daysPastDue(invoice.dueDate || invoice.date, args.today)} days overdue`,
      tone: "danger" as Tone,
      href: "/invoices",
    })),
    ...args.activePromises
      .filter((promise) => startOfDay(promise.promisedDate) <= startOfDay(args.today))
      .slice(0, 2)
      .map((promise) => ({
        id: `urgent-promise-${promise.id}`,
        title: `${promise.invoice.party.name} payment promise`,
        subtitle: promise.promisedAmount
          ? `${formatCompactCurrency(promise.promisedAmount, args.currency)} committed`
          : promise.invoice.invoiceNumber,
        dueLabel: startOfDay(promise.promisedDate) < startOfDay(args.today) ? "Promise missed" : "Due today",
        tone: startOfDay(promise.promisedDate) < startOfDay(args.today) ? ("danger" as Tone) : ("warning" as Tone),
        href: "/payments",
      })),
    ...args.openSalarySlips
      .slice(0, 1)
      .map((slip) => ({
        id: `urgent-salary-${slip.id}`,
        title: `${slip.employee.name} payroll item`,
        subtitle: `${formatMonthLabel(new Date(slip.year, slip.month - 1, 1))} • ${formatCompactCurrency(slip.finalPayableAmount, args.currency)}`,
        dueLabel: normalizeStatus(slip.status) === "DRAFT" ? "Needs processing" : "Awaiting payment",
        tone: normalizeStatus(slip.status) === "DRAFT" ? ("warning" as Tone) : ("primary" as Tone),
        href: "/hr/salary-process",
      })),
  ].slice(0, 3);

  const dueTodayItems: QueueItem[] = [
    ...args.dueTodayInvoices.slice(0, 2).map((invoice) => ({
      id: `due-invoice-${invoice.id}`,
      title: `${invoice.party.name} invoice due`,
      subtitle: `${invoice.invoiceNumber} • ${formatCompactCurrency(invoice.balanceAmount, args.currency)}`,
      dueLabel: "Due today",
      tone: "warning" as Tone,
      href: "/reports/invoices-due-today",
    })),
    ...args.promisesDueToday.slice(0, 2).map((promise) => ({
      id: `due-promise-${promise.id}`,
      title: `${promise.invoice.party.name} promise date`,
      subtitle: promise.promisedAmount
        ? `${formatCompactCurrency(promise.promisedAmount, args.currency)} expected`
        : promise.invoice.invoiceNumber,
      dueLabel: "Call today",
      tone: "warning" as Tone,
      href: "/reports/promises-due-today",
    })),
    ...args.upcomingDates
      .slice(0, 1)
      .map((row) => ({
        id: `due-upcoming-${row.id}`,
        title: row.secondary,
        subtitle: row.tertiary || row.primary,
        dueLabel: row.primary,
        tone: row.tone || ("primary" as Tone),
        href: row.href,
      })),
  ].slice(0, 3);

  const reviewReadyItems: QueueItem[] = [
    ...args.draftInvoices.slice(0, 2).map((invoice) => ({
      id: `review-invoice-${invoice.id}`,
      title: `${invoice.party.name} draft invoice`,
      subtitle: `${invoice.invoiceNumber} • ${formatCompactCurrency(invoice.baseGrandTotal, args.currency)}`,
      dueLabel: "Review ready",
      tone: "primary" as Tone,
      href: "/invoices",
    })),
    ...args.paymentsToPost.slice(0, 2).map((payment) => ({
      id: `review-payment-${payment.id}`,
      title: `${payment.party.name} payment to post`,
      subtitle: `${payment.paymentNumber} • ${formatCompactCurrency(payment.amount, args.currency)}`,
      dueLabel: payment.type === "PAY" ? "Post payout" : "Post receipt",
      tone: "primary" as Tone,
      href: "/payments",
    })),
    ...args.openSalarySlips
      .filter((slip) => normalizeStatus(slip.status) === "DRAFT")
      .slice(0, 1)
      .map((slip) => ({
        id: `review-salary-${slip.id}`,
        title: `${slip.employee.name} salary slip`,
        subtitle: `${formatMonthLabel(new Date(slip.year, slip.month - 1, 1))} • draft`,
        dueLabel: "Review ready",
        tone: "primary" as Tone,
        href: "/hr/salary-process",
      })),
  ].slice(0, 3);

  const alerts: AlertItem[] = [
    {
      id: "alert-overdue",
      title: "Overdue invoices",
      count: args.overdueInvoices.length,
      description: "Sales invoices already past due date and still carrying balance",
      tone: args.overdueInvoices.length > 0 ? "danger" : "success",
      href: "/reports/due-ageing",
    },
    {
      id: "alert-drafts",
      title: "Draft invoices pending",
      count: args.draftInvoices.length,
      description: "Draft invoices still waiting review before being sent or finalized",
      tone: args.draftInvoices.length > 0 ? "warning" : "success",
      href: "/reports/draft-invoices-today",
    },
    {
      id: "alert-payments",
      title: "Payments to post",
      count: args.paymentsToPost.length,
      description: "Payments captured but journal posting is still incomplete",
      tone: args.paymentsToPost.length > 0 ? "warning" : "success",
      href: "/payments",
    },
    {
      id: "alert-salary",
      title: "Salary items open",
      count: args.openSalarySlips.length,
      description: "Salary slips or payroll items still waiting processing or payment release",
      tone: args.openSalarySlips.length > 0 ? "primary" : "success",
      href: "/hr/salary-payment",
    },
    {
      id: "alert-promises",
      title: "Promises due today",
      count: args.promisesDueToday.length,
      description: "Collection promises committed by customers for today",
      tone: args.promisesDueToday.length > 0 ? "primary" : "success",
      href: "/reports/promises-due-today",
    },
  ];

  const financeSummary: DashboardStat[] = [
    {
      id: "finance-awaiting",
      label: "Invoices Awaiting Action",
      value: String(args.draftInvoices.length),
      delta: `${args.draftInvoices.length} drafts`,
      caption: "Invoices still waiting review, send, or follow-up",
      tone: args.draftInvoices.length > 0 ? "warning" : "success",
      href: "/invoices",
    },
    {
      id: "finance-payments",
      label: "Payments To Post",
      value: String(args.paymentsToPost.length),
      delta: `${args.paymentsToPost.filter((payment) => payment.type === "RECEIVE").length} receipts`,
      caption: "Payment records still missing final journal posting",
      tone: args.paymentsToPost.length > 0 ? "primary" : "success",
      href: "/payments",
    },
    {
      id: "finance-salary",
      label: "Open Salary Items",
      value: String(args.openSalarySlips.length),
      delta: formatCompactCurrency(args.salaryOutstandingAmount, args.currency),
      caption: "Payroll items still in process or awaiting payment release",
      tone: args.openSalarySlips.length > 0 ? "warning" : "success",
      href: "/hr/salary-process",
    },
  ];

  const financePendingRows: DashboardTableRow[] = [
    ...args.draftInvoices.slice(0, 2).map((invoice) => ({
      id: `pending-invoice-${invoice.id}`,
      primary: invoice.party.name,
      secondary: `${invoice.invoiceNumber} still in draft review`,
      tertiary: formatRelativeLabel(invoice.date, args.today),
      meta: normalizeStatus(invoice.type) === "PURCHASE" ? "Purchase invoice" : "Sales invoice",
      tone: "warning" as Tone,
      href: "/invoices",
    })),
    ...args.paymentsToPost.slice(0, 2).map((payment) => ({
      id: `pending-payment-${payment.id}`,
      primary: payment.party.name,
      secondary: `${payment.paymentNumber} still needs journal posting`,
      tertiary: payment.type === "PAY" ? "Supplier payment" : "Customer receipt",
      meta: formatRelativeLabel(payment.date, args.today),
      tone: "warning" as Tone,
      href: "/payments",
    })),
    ...args.openSalarySlips.slice(0, 1).map((slip) => ({
      id: `pending-salary-${slip.id}`,
      primary: slip.employee.name,
      secondary: `${formatMonthLabel(new Date(slip.year, slip.month - 1, 1))} salary item is still open`,
      tertiary: formatCompactCurrency(slip.finalPayableAmount, args.currency),
      meta: normalizeStatus(slip.status) === "DRAFT" ? "Payroll draft" : "Awaiting payment",
      tone: normalizeStatus(slip.status) === "DRAFT" ? ("warning" as Tone) : ("primary" as Tone),
      href: "/hr/salary-process",
    })),
  ].slice(0, 4);

  const recentCollectionRows = args.recentReceivePayments.slice(0, 4).map((payment) => ({
    id: `collection-${payment.id}`,
    primary: payment.party.name,
    secondary: `${formatCompactCurrency(payment.amount, args.currency)} received`,
    tertiary: payment.paymentNumber,
    meta: formatRelativeLabel(payment.date, args.today),
    tone: "success" as Tone,
    href: "/payments",
  }));

  const overdueRows = args.overdueInvoices.slice(0, 4).map((invoice) => ({
    id: `overdue-${invoice.id}`,
    primary: invoice.party.name,
    secondary: `${invoice.invoiceNumber} • ${formatCompactCurrency(invoice.balanceAmount, args.currency)}`,
    tertiary: `Overdue by ${daysPastDue(invoice.dueDate || invoice.date, args.today)} days`,
    meta: normalizeStatus(invoice.status),
    tone: resolveToneFromOverdue(daysPastDue(invoice.dueDate || invoice.date, args.today)),
    href: "/invoices",
  }));

  const promiseRows = args.activePromises.slice(0, 4).map((promise) => ({
    id: `promise-row-${promise.id}`,
    primary: promise.invoice.party.name,
    secondary: promise.promisedAmount
      ? `Promised ${formatCompactCurrency(promise.promisedAmount, args.currency)}`
      : `Promise against ${promise.invoice.invoiceNumber}`,
    tertiary: formatRelativeLabel(promise.promisedDate, args.today),
    meta: promise.invoice.invoiceNumber,
    tone: startOfDay(promise.promisedDate) < startOfDay(args.today) ? ("danger" as Tone) : ("warning" as Tone),
    href: "/payments",
  }));

  const employeeRows = args.openSalarySlips.slice(0, 4).map((slip) => ({
    id: `employee-${slip.id}`,
    primary: slip.employee.name,
    secondary: `${formatMonthLabel(new Date(slip.year, slip.month - 1, 1))} payroll item`,
    tertiary: formatCompactCurrency(slip.finalPayableAmount, args.currency),
    meta: normalizeStatus(slip.status) === "DRAFT" ? "Payroll processing" : "Awaiting payment",
    tone: normalizeStatus(slip.status) === "DRAFT" ? ("warning" as Tone) : ("primary" as Tone),
    href: "/hr/salary-process",
  }));

  return {
    role: args.role,
    roleLabel: args.role === "partner" ? "Partner View" : args.role === "manager" ? "Manager View" : "Operational View",
    generatedAt: `Generated from live data on ${formatDateLabel(args.today)}`,
    headerNote: commonHeaderNote,
    stats: statsByRole[args.role],
    priorities: {
      urgent: urgentItems,
      dueToday: dueTodayItems,
      reviewReady: reviewReadyItems,
    },
    alerts,
    finance: {
      summary: financeSummary,
      pendingRows: financePendingRows,
      recentCollections: recentCollectionRows,
    },
    receivables: {
      hero: [
        {
          id: "receivables-overdue",
          label: "Overdue Amount",
          value: formatCompactCurrency(overdueAmount, args.currency),
          delta: `${args.overdueInvoices.length} invoices`,
          caption: "Receivable balance already past due date",
          tone: overdueAmount > 0 ? "danger" : "success",
          href: "/reports/due-ageing",
        },
        {
          id: "receivables-promises",
          label: "Promises Due Today",
          value: String(args.promisesDueToday.length),
          delta: formatCompactCurrency(
            args.promisesDueToday.reduce((sum, promise) => sum + Number(promise.promisedAmount || 0), 0),
            args.currency,
          ),
          caption: "Committed follow-ups that need collection action today",
          tone: args.promisesDueToday.length > 0 ? "warning" : "success",
          href: "/reports/promises-due-today",
        },
        {
          id: "receivables-payments-week",
          label: "Payments This Week",
          value: formatCompactCurrency(args.receivePaymentsThisWeek, args.currency),
          delta: `${args.recentReceivePayments.length} receipts`,
          caption: "Receipts posted during the current week",
          tone: args.receivePaymentsThisWeek > 0 ? "success" : "primary",
          href: "/payments",
        },
      ],
      ageing: buildAgeingBuckets(args.openSalesInvoices, args.currency, args.today),
      overdueInvoices: overdueRows,
      promisesDue: promiseRows,
    },
    workload: {
      employees: employeeRows,
      managers: [],
    },
    attentionCustomers: args.attentionCustomers,
    recentActivity: args.recentActivity,
    upcomingDates: args.upcomingDates,
    visibility: {
      managers: false,
      attention: args.role !== "staff",
    },
  };
}

export async function GET() {
  try {
    const orgCtx = await requireOrganizationContext();
    const permissionCtx = await getPermissionContext();
    const organizationId = orgCtx.activeOrganizationId!;
    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);
    const monthStart = startOfMonth(today);
    const previousMonthStart = startOfPreviousMonth(today);
    const previousMonthEnd = endOfPreviousMonth(today);
    const weekStart = startOfDay(addDays(today, -6));
    const next14Days = endOfDay(addDays(today, 14));
    const salesTrendStart = startOfMonth(today);
    salesTrendStart.setMonth(salesTrendStart.getMonth() - 11);

    const role = await resolveRoleViewServer(permissionCtx.userId, permissionCtx.isSuperadmin, organizationId);

    const [
      settings,
      activeCustomersCount,
      activeEmployeesCount,
      draftInvoices,
      openSalesInvoices,
      paymentsToPost,
      recentReceivePayments,
      recentPayments,
      recentInvoices,
      recentJournals,
      journalThisMonth,
      journalLastMonth,
      receivePaymentsThisMonthAgg,
      receivePaymentsLastMonthAgg,
      receivePaymentsThisWeekAgg,
      latestSalarySlip,
      upcomingSalaryPayments,
      salesInvoicesTrend,
      activePromises,
    ] = await Promise.all([
      prisma.companySettings.findUnique({
        where: { organizationId },
        select: { dashboardConfig: true, baseCurrency: true },
      }),
      prisma.party.count({
        where: {
          organizationId,
          isActive: true,
          type: { in: ["CUSTOMER", "BOTH"] },
        },
      }),
      prisma.employee.count({
        where: {
          organizationId,
          status: "ACTIVE",
        },
      }),
      prisma.invoice.findMany({
        where: {
          organizationId,
          status: "DRAFT",
        },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          invoiceNumber: true,
          type: true,
          status: true,
          date: true,
          dueDate: true,
          baseGrandTotal: true,
          paidAmount: true,
          balanceAmount: true,
          createdAt: true,
          party: {
            select: {
              id: true,
              name: true,
              currency: true,
              creditLimit: true,
            },
          },
          paymentPromises: {
            where: { status: "ACTIVE" },
            select: {
              id: true,
              promisedDate: true,
              promisedAmount: true,
              status: true,
            },
          },
        },
      }),
      prisma.invoice.findMany({
        where: {
          organizationId,
          type: "SALE",
          status: { notIn: ["DRAFT", "CANCELLED"] },
          balanceAmount: { gt: 0 },
        },
        orderBy: [{ dueDate: "asc" }, { date: "asc" }],
        select: {
          id: true,
          invoiceNumber: true,
          type: true,
          status: true,
          date: true,
          dueDate: true,
          baseGrandTotal: true,
          paidAmount: true,
          balanceAmount: true,
          createdAt: true,
          party: {
            select: {
              id: true,
              name: true,
              currency: true,
              creditLimit: true,
            },
          },
          paymentPromises: {
            where: { status: "ACTIVE" },
            select: {
              id: true,
              promisedDate: true,
              promisedAmount: true,
              status: true,
            },
          },
        },
      }),
      prisma.payment.findMany({
        where: {
          organizationId,
          journalEntryId: null,
        },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          paymentNumber: true,
          date: true,
          type: true,
          amount: true,
          journalEntryId: true,
          createdAt: true,
          party: {
            select: { id: true, name: true },
          },
          invoiceId: true,
        },
      }),
      prisma.payment.findMany({
        where: {
          organizationId,
          type: "RECEIVE",
        },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          paymentNumber: true,
          date: true,
          type: true,
          amount: true,
          journalEntryId: true,
          createdAt: true,
          party: {
            select: { id: true, name: true },
          },
          invoiceId: true,
        },
      }),
      prisma.payment.findMany({
        where: {
          organizationId,
        },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          paymentNumber: true,
          date: true,
          type: true,
          amount: true,
          journalEntryId: true,
          createdAt: true,
          party: {
            select: { id: true, name: true },
          },
          invoiceId: true,
        },
      }),
      prisma.invoice.findMany({
        where: {
          organizationId,
          status: { not: "CANCELLED" },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          invoiceNumber: true,
          type: true,
          status: true,
          createdAt: true,
          party: {
            select: { name: true },
          },
        },
      }),
      prisma.journalEntry.findMany({
        where: {
          organizationId,
        },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          entryNumber: true,
          description: true,
          createdAt: true,
        },
      }),
      prisma.journalEntry.count({
        where: {
          organizationId,
          date: { gte: monthStart },
        },
      }),
      prisma.journalEntry.count({
        where: {
          organizationId,
          date: {
            gte: previousMonthStart,
            lte: previousMonthEnd,
          },
        },
      }),
      prisma.payment.aggregate({
        where: {
          organizationId,
          type: "RECEIVE",
          journalEntryId: { not: null },
          date: { gte: monthStart },
        },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: {
          organizationId,
          type: "RECEIVE",
          journalEntryId: { not: null },
          date: {
            gte: previousMonthStart,
            lte: previousMonthEnd,
          },
        },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: {
          organizationId,
          type: "RECEIVE",
          journalEntryId: { not: null },
          date: { gte: weekStart },
        },
        _sum: { amount: true },
      }),
      prisma.salarySlip.findFirst({
        where: { organizationId },
        orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
        select: { month: true, year: true },
      }),
      prisma.salaryPayment.findMany({
        where: {
          organizationId,
          date: {
            gte: todayStart,
            lte: next14Days,
          },
        },
        orderBy: { date: "asc" },
        take: 6,
        select: {
          id: true,
          date: true,
          amount: true,
          status: true,
          createdAt: true,
          employee: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.invoice.findMany({
        where: {
          organizationId,
          type: "SALE",
          status: { notIn: ["DRAFT", "CANCELLED"] },
          journalEntryId: { not: null },
          date: { gte: salesTrendStart },
        },
        select: {
          date: true,
          baseGrandTotal: true,
        },
        orderBy: { date: "asc" },
      }),
      prisma.paymentPromise.findMany({
        where: {
          organizationId,
          status: "ACTIVE",
          promisedDate: {
            lte: next14Days,
          },
        },
        orderBy: { promisedDate: "asc" },
        take: 12,
        select: {
          id: true,
          promisedDate: true,
          promisedAmount: true,
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              party: {
                select: { name: true },
              },
            },
          },
        },
      }),
    ]);

    const baseCurrency = settings?.baseCurrency || "PKR";

    const salaryPeriodStart = latestSalarySlip
      ? new Date(latestSalarySlip.year, latestSalarySlip.month - 1, 1)
      : startOfMonth(today);
    const salaryPeriodEnd = latestSalarySlip
      ? endOfDay(new Date(latestSalarySlip.year, latestSalarySlip.month, 0))
      : endOfDay(addDays(new Date(salaryPeriodStart.getFullYear(), salaryPeriodStart.getMonth() + 1, 0), 0));

    const [salarySlipsForPeriod, salaryPaymentsForPeriod, recentSalaryPayments] = await Promise.all([
      prisma.salarySlip.findMany({
        where: {
          organizationId,
          year: salaryPeriodStart.getFullYear(),
          month: salaryPeriodStart.getMonth() + 1,
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          month: true,
          year: true,
          finalPayableAmount: true,
          payableAmount: true,
          status: true,
          createdAt: true,
          employee: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.salaryPayment.aggregate({
        where: {
          organizationId,
          date: {
            gte: salaryPeriodStart,
            lte: salaryPeriodEnd,
          },
        },
        _sum: { amount: true },
      }),
      prisma.salaryPayment.findMany({
        where: {
          organizationId,
        },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: {
          id: true,
          date: true,
          amount: true,
          status: true,
          createdAt: true,
          employee: {
            select: { id: true, name: true },
          },
        },
      }),
    ]);

    const openSalesInvoiceRows = openSalesInvoices as InvoiceRecord[];
    const overdueInvoices = openSalesInvoiceRows
      .filter((invoice) => invoice.dueDate && startOfDay(invoice.dueDate) < todayStart)
      .sort((a, b) => {
        const overdueDiff = daysPastDue(b.dueDate || b.date, today) - daysPastDue(a.dueDate || a.date, today);
        if (overdueDiff !== 0) return overdueDiff;
        return Number(b.balanceAmount || 0) - Number(a.balanceAmount || 0);
      });
    const dueTodayInvoices = openSalesInvoiceRows
      .filter((invoice) => invoice.dueDate && startOfDay(invoice.dueDate).getTime() === todayStart.getTime())
      .sort((a, b) => Number(b.balanceAmount || 0) - Number(a.balanceAmount || 0));
    const promisesDueToday = (activePromises || []).filter(
      (promise) => startOfDay(promise.promisedDate).getTime() === todayStart.getTime(),
    );
    const attentionCustomers = buildAttentionCustomers(openSalesInvoiceRows, baseCurrency, today);
    const salaryOutstandingAmount = Math.max(
      salarySlipsForPeriod
        .filter((slip) => normalizeStatus(slip.status) !== "DRAFT")
        .reduce((sum, slip) => sum + Number(slip.finalPayableAmount || slip.payableAmount || 0), 0) -
        Number(salaryPaymentsForPeriod._sum.amount || 0),
      0,
    );
    const openSalarySlips = (salarySlipsForPeriod as SalarySlipRecord[]).filter((slip) =>
      ["DRAFT", "POSTED", "PENDING", "APPROVED"].includes(normalizeStatus(slip.status)),
    );
    const recentActivity = buildRecentActivityRows({
      recentInvoices,
      recentPayments: recentPayments as PaymentRecord[],
      recentJournals,
      recentSalaryPayments: recentSalaryPayments as SalaryPaymentRecord[],
      today,
    });
    const upcomingDates = buildUpcomingRows({
      dueTodayInvoices,
      overdueInvoices,
      activePromises,
      upcomingSalaryPayments: upcomingSalaryPayments as SalaryPaymentRecord[],
      today,
      currency: baseCurrency,
    });
    const snapshot = buildSnapshot({
      role,
      currency: baseCurrency,
      today,
      activeCustomersCount,
      draftInvoices: draftInvoices as InvoiceRecord[],
      dueTodayInvoices,
      openSalesInvoices: openSalesInvoiceRows,
      overdueInvoices,
      attentionCustomers,
      receivePaymentsThisMonth: Number(receivePaymentsThisMonthAgg._sum.amount || 0),
      receivePaymentsLastMonth: Number(receivePaymentsLastMonthAgg._sum.amount || 0),
      receivePaymentsThisWeek: Number(receivePaymentsThisWeekAgg._sum.amount || 0),
      journalThisMonth,
      journalLastMonth,
      activeEmployeesCount,
      openSalarySlips,
      salaryOutstandingAmount,
      paymentsToPost: paymentsToPost as PaymentRecord[],
      recentReceivePayments: recentReceivePayments as PaymentRecord[],
      promisesDueToday,
      activePromises,
      recentActivity,
      upcomingDates,
      recentJournals,
    });

    return NextResponse.json({
      dashboardConfig: parseDashboardConfig(settings?.dashboardConfig),
      salesLast12Months: buildSalesTrend(salesInvoicesTrend),
      baseCurrency,
      widgetPermissions: buildWidgetPermissions(permissionCtx),
      canCustomize: await getCustomizationAccess(
        permissionCtx.userId,
        organizationId,
        permissionCtx.permissions,
        permissionCtx.isSuperadmin,
      ),
      snapshot,
    });
  } catch (error) {
    console.error("Failed to load dashboard config:", error);
    return NextResponse.json(
      {
        dashboardConfig: {},
        salesLast12Months: [],
        baseCurrency: "PKR",
        widgetPermissions: {},
        canCustomize: false,
        snapshot: null,
      },
      { status: 200 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const orgCtx = await requireOrganizationContext();
    const permissionCtx = await getPermissionContext();
    const organizationId = orgCtx.activeOrganizationId!;
    const canCustomize = await getCustomizationAccess(
      permissionCtx.userId,
      organizationId,
      permissionCtx.permissions,
      permissionCtx.isSuperadmin,
    );

    if (!canCustomize) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const body = await request.json();
    const nextConfig = parseDashboardConfig(body?.dashboardConfig);

    const existing = await prisma.companySettings.findUnique({
      where: { organizationId },
      select: { id: true },
    });

    if (existing) {
      await prisma.companySettings.update({
        where: { id: existing.id },
        data: { dashboardConfig: nextConfig },
      });
    } else {
      await prisma.companySettings.create({
        data: {
          organizationId,
          companyName: orgCtx.activeOrganizationName || "Company",
          dashboardConfig: nextConfig,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save dashboard config:", error);
    return NextResponse.json({ error: "Failed to save dashboard config" }, { status: 500 });
  }
}
