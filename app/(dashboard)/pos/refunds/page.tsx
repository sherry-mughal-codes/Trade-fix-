import Link from "next/link";
import { ArrowLeft, RefreshCcw, FileText, Clock, CreditCard } from "lucide-react";
import { requirePOSAccess } from "../access";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { requireOrganizationId, withOrganization } from "@/lib/tenant-db";

export const dynamic = "force-dynamic";

export default async function POSRefundsPage() {
  await requirePOSAccess();
  await requirePermission("pos.refund.do");
  const orgId = await requireOrganizationId();

  const refunds = await prisma.pOSRefund.findMany({
    where: withOrganization(orgId, {}),
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      invoice: { select: { id: true, invoiceNumber: true } },
      reversalPayment: { select: { id: true, paymentNumber: true, method: true, amount: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 2 }).format(n);

  const fmtDate = (d: Date) =>
    new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(d));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/pos" className="rounded-full p-2 transition-colors hover:bg-accent">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">POS Refunds</h1>
          <p className="text-sm text-muted-foreground">Refund Branch A (invoice reversal) and Branch B (standalone journal entry) log.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm flex items-center gap-3">
          <div className="rounded-lg bg-rose-500/10 text-rose-600 p-2">
            <RefreshCcw className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground tracking-wide">Last 30 refunds</div>
            <div className="text-lg font-semibold">{refunds.length}</div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm flex items-center gap-3">
          <div className="rounded-lg bg-sky-500/10 text-sky-600 p-2">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground tracking-wide">Branch A — Reversals</div>
            <div className="text-lg font-semibold">{refunds.filter((r) => r.branch === "INVOICE_REVERSAL").length}</div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm flex items-center gap-3">
          <div className="rounded-lg bg-violet-500/10 text-violet-600 p-2">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground tracking-wide">Branch B — Standalone</div>
            <div className="text-lg font-semibold">{refunds.filter((r) => r.branch === "STANDALONE_JE").length}</div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Refund #</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Branch</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Invoice</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Method</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Amount</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Reason</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Cashier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {refunds.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    No POS refunds yet. Use the <span className="font-semibold text-foreground">Refund</span> button in the POS counter to issue a new refund.
                  </td>
                </tr>
              )}
              {refunds.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-mono text-minia-primary font-medium">{r.refundNumber}</td>
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {fmtDate(r.createdAt)}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.branch === "INVOICE_REVERSAL" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-700">
                        Branch A · Reverse
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                        Branch B · JE Only
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground font-mono">
                    {r.invoice?.invoiceNumber || (
                      <span className="text-muted-foreground/60 italic">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border bg-background text-xs font-medium">
                      {r.reversalPayment?.method || r.refundMethod || "CASH"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-rose-600 font-semibold">
                    {fmtMoney(Number(r.grandTotal || r.reversalPayment?.amount || 0))}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground max-w-[18ch] truncate" title={r.reason || ""}>
                    {r.reason || <span className="italic text-muted-foreground/60">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {r.user?.name || <span className="italic text-muted-foreground/60">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
