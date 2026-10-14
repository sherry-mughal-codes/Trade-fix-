export type RoleView = "partner" | "manager" | "staff";
export type Tone = "primary" | "success" | "warning" | "danger" | "neutral";

export interface DashboardStat {
  id: string;
  label: string;
  value: string;
  delta: string;
  caption: string;
  tone: Tone;
  href: string;
}

export interface QueueItem {
  id: string;
  title: string;
  subtitle: string;
  dueLabel: string;
  tone: Tone;
  href: string;
}

export interface AlertItem {
  id: string;
  title: string;
  count: number;
  description: string;
  tone: Tone;
  href: string;
}

export interface LinkCount {
  label: string;
  value: number;
  tone: Tone;
  href: string;
}

export interface DashboardTableRow {
  id: string;
  primary: string;
  secondary: string;
  tertiary?: string;
  meta?: string;
  tone?: Tone;
  href: string;
}

export interface BillingGridRow {
  customer: string;
  manager: string;
  months: Array<{
    label: string;
    status: "not-scheduled" | "draft" | "sent" | "partial" | "paid" | "overdue";
  }>;
  href: string;
}

export interface AgeingBucket {
  label: string;
  amount: string;
  percentage: number;
}

export interface AttentionCustomer {
  id: string;
  customer: string;
  riskScore: number;
  issues: string[];
  receivableAmount: string;
  nextAction: string;
  href: string;
}

export interface DashboardSnapshot {
  role: RoleView;
  roleLabel: string;
  generatedAt: string;
  headerNote: string;
  stats: DashboardStat[];
  priorities: {
    urgent: QueueItem[];
    dueToday: QueueItem[];
    reviewReady: QueueItem[];
  };
  alerts: AlertItem[];
  finance: {
    summary: DashboardStat[];
    pendingRows: DashboardTableRow[];
    recentCollections: DashboardTableRow[];
  };
  receivables: {
    hero: DashboardStat[];
    ageing: AgeingBucket[];
    overdueInvoices: DashboardTableRow[];
    promisesDue: DashboardTableRow[];
  };
  workload: {
    employees: DashboardTableRow[];
    managers: DashboardTableRow[];
  };
  attentionCustomers: AttentionCustomer[];
  recentActivity: DashboardTableRow[];
  upcomingDates: DashboardTableRow[];
  visibility: {
    managers: boolean;
    attention: boolean;
  };
}

const partnerSnapshot: DashboardSnapshot = {
  role: "partner",
  roleLabel: "Partner View",
  generatedAt: "Generated at 9:30 AM using curated dummy operational data",
  headerNote: "Built to review financial health, collections pressure, payroll activity, and customer risk at a glance.",
  stats: [
    { id: "customers", label: "Active Customers", value: "62", delta: "+5 this quarter", caption: "Customer accounts currently enabled for invoicing and collections", tone: "primary", href: "/customers" },
    { id: "drafts", label: "Draft Invoices", value: "21", delta: "Ready for review", caption: "Current invoices waiting review or posting", tone: "warning", href: "/invoices" },
    { id: "invoices-due", label: "Invoices Due Today", value: "7", delta: "PKR 1.18M", caption: "Invoices that need collection movement today", tone: "warning", href: "/invoices" },
    { id: "receivables", label: "Outstanding Receivables", value: "PKR 8.45M", delta: "PKR 3.12M overdue", caption: "Open invoice exposure across customers", tone: "danger", href: "/reports/receivable-summary" },
    { id: "payments", label: "Payments This Month", value: "PKR 1.26M", delta: "+18% vs last month", caption: "Cash received and posted in current month", tone: "success", href: "/payments" },
    { id: "journal", label: "Journal Entries", value: "54", delta: "11 pending review", caption: "Journal activity posted during the month", tone: "primary", href: "/journal" },
    { id: "employees", label: "Active Employees", value: "18", delta: "2 salary batches open", caption: "Employees included in the current payroll cycle", tone: "primary", href: "/hr/employees" },
    { id: "salary", label: "Salary Payables", value: "PKR 940K", delta: "Due this week", caption: "Outstanding salary payments awaiting release", tone: "warning", href: "/hr/salary-payment" },
  ],
  priorities: {
    urgent: [
      { id: "u1", title: "Zamindar Feeds invoice promise follow-up", subtitle: "Promise date today • PKR 420,000", dueLabel: "Collection at risk", tone: "danger", href: "/payments" },
      { id: "u2", title: "June salary batch still unposted", subtitle: "2 salary slips waiting final review", dueLabel: "Due today", tone: "danger", href: "/hr/salary-process" },
      { id: "u3", title: "Falcon Cables overdue invoice escalation", subtitle: "Invoice INV-2026-147 • 18 days overdue", dueLabel: "High risk", tone: "danger", href: "/invoices" },
    ],
    dueToday: [
      { id: "d1", title: "Review 9 draft invoices", subtitle: "Month-end batch ready for verification", dueLabel: "Review by 4:00 PM", tone: "warning", href: "/invoices" },
      { id: "d2", title: "Post 3 customer receipts", subtitle: "Bank statement matched, journal still pending", dueLabel: "Post today", tone: "warning", href: "/payments" },
      { id: "d3", title: "Payroll release approvals", subtitle: "June salary payments for 8 employees", dueLabel: "Approve today", tone: "warning", href: "/hr/salary-payment" },
    ],
    reviewReady: [
      { id: "r1", title: "Receivable ageing review pack", subtitle: "90+ day exposure concentrated in 4 customers", dueLabel: "Partner review", tone: "primary", href: "/reports/receivable-summary" },
      { id: "r2", title: "Cash receipt journals matched", subtitle: "5 receipts ready to finalize", dueLabel: "Ready to post", tone: "primary", href: "/journal" },
      { id: "r3", title: "Team workload rebalancing required", subtitle: "2 handlers above normal open receivable threshold", dueLabel: "Management review", tone: "primary", href: "/settings/users" },
    ],
  },
  alerts: [
    { id: "a1", title: "Overdue invoices", count: 14, description: "Invoices already past due date and still open", tone: "danger", href: "/reports/receivable-summary" },
    { id: "a2", title: "Draft invoices pending", count: 9, description: "Draft invoices still waiting review before dispatch", tone: "warning", href: "/invoices" },
    { id: "a3", title: "Unposted receipts", count: 5, description: "Payments captured but journal posting still incomplete", tone: "warning", href: "/payments" },
    { id: "a4", title: "Salary payments due", count: 8, description: "Approved salary slips waiting payment release", tone: "primary", href: "/hr/salary-payment" },
    { id: "a5", title: "Promises due today", count: 4, description: "Collection follow-ups committed by customers for today", tone: "primary", href: "/payments" },
  ],
  finance: {
    summary: [
      { id: "s1", label: "Invoices Awaiting Action", value: "21", delta: "9 drafts", caption: "Invoices still waiting review, send, or posting", tone: "warning", href: "/invoices" },
      { id: "s2", label: "Payments To Post", value: "5", delta: "3 bank, 2 cash", caption: "Receipts captured and waiting final journal entry", tone: "primary", href: "/payments" },
      { id: "s3", label: "Open Salary Batches", value: "2", delta: "June + July prep", caption: "Salary cycles still being processed", tone: "warning", href: "/hr/salary-process" },
    ],
    pendingRows: [
      { id: "sp1", primary: "Falcon Cables", secondary: "Invoice INV-2026-147 still in draft review", tertiary: "Due today", meta: "Owner: Ahmed Raza", tone: "warning", href: "/invoices" },
      { id: "sp2", primary: "Zamindar Feeds", secondary: "Receipt for PKR 220,000 needs posting", tertiary: "Due in 1 day", meta: "Collector: Sana Tariq", tone: "warning", href: "/payments" },
      { id: "sp3", primary: "June payroll batch", secondary: "2 salary slips still not posted", tertiary: "Overdue by 1 day", meta: "HR: Sana Tariq", tone: "danger", href: "/hr/salary-process" },
      { id: "sp4", primary: "Receivable follow-up list", secondary: "4 customers with promises due today", tertiary: "Needs calls", meta: "Collections team", tone: "warning", href: "/reports/promises-due-today" },
    ],
    recentCollections: [
      { id: "rc1", primary: "Orient Plastics", secondary: "PKR 140,000 received", tertiary: "Bank transfer", meta: "2 hrs ago", tone: "success", href: "/payments" },
      { id: "rc2", primary: "Barani Farms", secondary: "PKR 95,000 received", tertiary: "Cash", meta: "Today", tone: "success", href: "/payments" },
      { id: "rc3", primary: "Nova Oils", secondary: "PKR 210,000 promise confirmed", tertiary: "Expected tomorrow", meta: "Collector: Ahmed Raza", tone: "primary", href: "/payments" },
    ],
  },
  receivables: {
    hero: [
      { id: "r1", label: "Overdue Amount", value: "PKR 3.12M", delta: "37% of outstanding", caption: "Receivable amount already past due date", tone: "danger", href: "/reports/receivable-summary" },
      { id: "r2", label: "Promises Due Today", value: "4", delta: "PKR 690,000", caption: "Committed follow-ups that need collection action", tone: "warning", href: "/payments" },
      { id: "r3", label: "Payments This Week", value: "PKR 840K", delta: "9 receipts posted", caption: "Collections posted during the current week", tone: "success", href: "/payments" },
    ],
    ageing: [
      { label: "0-30 days", amount: "PKR 2.46M", percentage: 29 },
      { label: "31-60 days", amount: "PKR 1.92M", percentage: 23 },
      { label: "61-90 days", amount: "PKR 1.35M", percentage: 16 },
      { label: "90+ days", amount: "PKR 2.72M", percentage: 32 },
    ],
    overdueInvoices: [
      { id: "oi1", primary: "Falcon Cables", secondary: "INV-2026-147 • PKR 360,000", tertiary: "Overdue by 18 days", meta: "Manager: Farooq Malik", tone: "danger", href: "/invoices" },
      { id: "oi2", primary: "Zamindar Feeds", secondary: "INV-2026-133 • PKR 420,000", tertiary: "Overdue by 11 days", meta: "Collection promise today", tone: "danger", href: "/invoices" },
      { id: "oi3", primary: "Barani Farms", secondary: "INV-2026-129 • PKR 210,000", tertiary: "Overdue by 7 days", meta: "Needs escalation", tone: "warning", href: "/invoices" },
    ],
    promisesDue: [
      { id: "pd1", primary: "Zamindar Feeds", secondary: "Promised PKR 220,000", tertiary: "Due today", meta: "Collector: Sana Tariq", tone: "warning", href: "/payments" },
      { id: "pd2", primary: "Orient Plastics", secondary: "Promised PKR 140,000", tertiary: "Due today", meta: "Collector: Ahmed Raza", tone: "warning", href: "/payments" },
      { id: "pd3", primary: "Sapphire Power Ltd", secondary: "Promised PKR 330,000", tertiary: "Due tomorrow", meta: "Collector: Hira Amin", tone: "primary", href: "/payments" },
    ],
  },
  workload: {
    employees: [
      { id: "we1", primary: "Hira Amin", secondary: "19 open items • 4 overdue", tertiary: "11 completed this week", meta: "Collections heavy", tone: "warning", href: "/settings/users" },
      { id: "we2", primary: "Ahmed Raza", secondary: "22 open items • 2 overdue", tertiary: "13 completed this week", meta: "Strong invoice turnaround", tone: "success", href: "/settings/users" },
      { id: "we3", primary: "Sana Tariq", secondary: "17 open items • 3 overdue", tertiary: "8 completed this week", meta: "Operational follow-ups", tone: "warning", href: "/settings/users" },
      { id: "we4", primary: "Qasim Javed", secondary: "15 open items • 1 overdue", tertiary: "9 completed this week", meta: "Balanced workload", tone: "primary", href: "/settings/users" },
    ],
    managers: [
      { id: "wm1", primary: "Farooq Malik", secondary: "43 team pending • 7 critical", tertiary: "2 handlers above capacity", meta: "Needs rebalancing", tone: "warning", href: "/settings/users" },
      { id: "wm2", primary: "Sadia Noor", secondary: "35 team pending • 4 critical", tertiary: "Collections stable", meta: "Monitoring team workload", tone: "primary", href: "/settings/users" },
    ],
  },
  attentionCustomers: [
    { id: "ac1", customer: "Falcon Cables", riskScore: 91, issues: ["Overdue invoice", "Promise missed", "Draft invoice pending"], receivableAmount: "PKR 360,000", nextAction: "Escalate collections and finalize disputed draft", href: "/customers" },
    { id: "ac2", customer: "Zamindar Feeds", riskScore: 87, issues: ["Promise due today", "Ageing 60+", "Repeated partial receipts"], receivableAmount: "PKR 420,000", nextAction: "Call customer and confirm same-day payment", href: "/customers" },
    { id: "ac3", customer: "Nova Oils", riskScore: 78, issues: ["Large outstanding balance", "Unposted receipt", "Credit exposure"], receivableAmount: "PKR 190,000", nextAction: "Post receipt and review credit hold", href: "/customers" },
    { id: "ac4", customer: "Barani Farms", riskScore: 73, issues: ["Invoice overdue", "Late promise", "Manual follow-up"], receivableAmount: "PKR 210,000", nextAction: "Reschedule collection and update notes", href: "/customers" },
  ],
  recentActivity: [
    { id: "ra1", primary: "Draft invoice created", secondary: "Invoice generated for Al-Faisal Textiles", tertiary: "Invoices", meta: "18 min ago", tone: "primary", href: "/invoices" },
    { id: "ra2", primary: "Payment received", secondary: "PKR 140,000 posted from Orient Plastics", tertiary: "Payments", meta: "42 min ago", tone: "success", href: "/payments" },
    { id: "ra3", primary: "Journal entry posted", secondary: "Receipt journal completed for Nova Oils collection", tertiary: "Journal", meta: "1 hr ago", tone: "primary", href: "/journal" },
    { id: "ra4", primary: "Salary payment approved", secondary: "June salaries approved for 8 employees", tertiary: "HR", meta: "2 hrs ago", tone: "success", href: "/hr/salary-payment" },
    { id: "ra5", primary: "Customer attention raised", secondary: "Zamindar Feeds moved to high-risk queue", tertiary: "Dashboard rule", meta: "Today", tone: "danger", href: "/customers" },
  ],
  upcomingDates: [
    { id: "up1", primary: "10 Jul", secondary: "June payroll release", tertiary: "8 salary payments", meta: "HR", tone: "warning", href: "/hr/salary-payment" },
    { id: "up2", primary: "11 Jul", secondary: "Falcon Cables invoice due", tertiary: "INV-2026-147", meta: "Collections", tone: "warning", href: "/invoices" },
    { id: "up3", primary: "12 Jul", secondary: "Zamindar Feeds promise date", tertiary: "PKR 220,000", meta: "Payments", tone: "warning", href: "/payments" },
    { id: "up4", primary: "13 Jul", secondary: "Monthly draft review cutoff", tertiary: "9 invoices", meta: "Invoices", tone: "primary", href: "/invoices" },
    { id: "up5", primary: "14 Jul", secondary: "General ledger month close", tertiary: "Accounts review", meta: "Journal", tone: "primary", href: "/reports/general-ledger" },
  ],
  visibility: {
    managers: true,
    attention: true,
  },
};

export const dashboardSnapshots: Record<RoleView, DashboardSnapshot> = {
  partner: partnerSnapshot,
  manager: {
    ...partnerSnapshot,
    role: "manager",
    roleLabel: "Manager View",
    generatedAt: "Generated at 9:30 AM using manager-level dummy workload data",
    headerNote: "Built to control deadlines, receivables, team workload, and approval-ready finance actions.",
    stats: [
      { id: "customers", label: "Managed Customers", value: "27", delta: "+2 this month", caption: "Customers under current team supervision", tone: "primary", href: "/customers" },
      { id: "drafts", label: "Drafts For Review", value: "9", delta: "PKR 2.14M", caption: "Drafts waiting team-level verification", tone: "primary", href: "/invoices" },
      { id: "invoices-due", label: "Due Collections", value: "4", delta: "2 promises today", caption: "Invoices requiring collections follow-up", tone: "warning", href: "/payments" },
      { id: "receivables", label: "Team Receivables", value: "PKR 3.84M", delta: "PKR 1.42M overdue", caption: "Receivables under current manager scope", tone: "danger", href: "/reports/receivable-summary" },
      { id: "payments", label: "Completed This Week", value: "34", delta: "Payments + journals", caption: "Finished items across assigned team members", tone: "success", href: "/payments" },
      { id: "salary", label: "Salary Approvals", value: "2", delta: "Pending final approval", caption: "Payroll batches waiting review", tone: "warning", href: "/hr/salary-process" },
      { id: "journal", label: "Journals To Post", value: "7", delta: "Month-close", caption: "Entries waiting posting or adjustment", tone: "primary", href: "/journal" },
      { id: "customers-risk", label: "High-Risk Customers", value: "3", delta: "Needs escalation", caption: "Customers requiring management follow-up", tone: "danger", href: "/customers" },
    ],
    workload: {
      employees: partnerSnapshot.workload.employees.slice(0, 3),
      managers: partnerSnapshot.workload.managers.slice(0, 1),
    },
    attentionCustomers: partnerSnapshot.attentionCustomers.slice(0, 3),
  },
  staff: {
    ...partnerSnapshot,
    role: "staff",
    roleLabel: "Staff View",
    generatedAt: "Generated at 9:30 AM using personal dummy workbench data",
    headerNote: "Built to show my deadlines, assigned customers, finance tasks, and the most recent actions I need to continue.",
    stats: [
      { id: "my-open", label: "My Open Items", value: "18", delta: "5 due today", caption: "Assigned invoices, payments, and payroll actions", tone: "primary", href: "/invoices" },
      { id: "my-customers", label: "Assigned Customers", value: "12", delta: "3 high risk", caption: "Customers currently under my follow-up", tone: "warning", href: "/customers" },
      { id: "my-payments", label: "My Collections Due", value: "5", delta: "2 overdue", caption: "Customer receipts and promise follow-ups assigned to me", tone: "warning", href: "/payments" },
      { id: "my-overdue", label: "My Overdue Items", value: "3", delta: "1 critical", caption: "Items already beyond target date", tone: "danger", href: "/payments" },
      { id: "my-completed", label: "Completed This Week", value: "11", delta: "+3 vs last week", caption: "Payments, journals, and payroll tasks closed by me", tone: "success", href: "/journal" },
      { id: "my-dates", label: "Upcoming Dates", value: "4", delta: "2 this week", caption: "Invoice, payroll, and collection deadlines", tone: "primary", href: "/payments" },
      { id: "my-review", label: "Awaiting Review", value: "2", delta: "Manager response pending", caption: "Items ready for management review", tone: "warning", href: "/invoices" },
      { id: "my-feed", label: "Recent Actions", value: "7", delta: "Since yesterday", caption: "Recent items completed or updated by me", tone: "success", href: "/journal" },
    ],
    receivables: partnerSnapshot.receivables,
    visibility: {
      managers: false,
      attention: false,
    },
    attentionCustomers: partnerSnapshot.attentionCustomers.slice(0, 2),
  },
};
