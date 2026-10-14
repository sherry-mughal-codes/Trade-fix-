import Link from "next/link";
import {
  FileSpreadsheet,
  Clock,
  ArrowDownLeft,
} from "lucide-react";
import { requirePageAccess } from "@/lib/rbac";
import { hasPermission } from "@/lib/rbac";

const reports = [
  {
    title: "General Ledger",
    description: "View detailed transaction history for all accounts with date filtering.",
    icon: FileSpreadsheet,
    href: "/reports/general-ledger",
    permission: "reports.generalLedger",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    title: "Receivable Summary",
    description: "Summary of outstanding invoices from customers.",
    icon: ArrowDownLeft,
    href: "/reports/receivable-summary",
    permission: "reports.receivableSummary",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  {
    title: "Invoices Due Today",
    description: "Invoices with balance due and due date today.",
    icon: Clock,
    href: "/reports/invoices-due-today",
    permission: "reports.invoicesDueToday",
    color: "text-minia-warning",
    bgColor: "bg-minia-warning/10",
  },
  {
    title: "Due Ageing",
    description: "Overall due invoices with ageing buckets.",
    icon: FileSpreadsheet,
    href: "/reports/due-ageing",
    permission: "reports.dueAgeing",
    color: "text-minia-danger",
    bgColor: "bg-minia-danger/10",
  },
];

export default async function ReportsPage() {
  await requirePageAccess("reports.access", "/");

  const visibleReports = [];
  for (const report of reports) {
    if (await hasPermission(report.permission)) {
      visibleReports.push(report);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            View TradeFix finance, receivable, and invoice reports.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {visibleReports.map((report) => {
          const Icon = report.icon;
          return (
            <Link
              key={report.href}
              href={report.href}
              className="block group"
            >
              <div className="h-full rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className={`p-3 rounded-full ${report.bgColor}`}>
                    <Icon className={`h-6 w-6 ${report.color}`} />
                  </div>
                  <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                    {report.title}
                  </h3>
                </div>
                <p className="text-muted-foreground text-sm">
                  {report.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
