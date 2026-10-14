import Link from "next/link";
import { ArrowLeft, Lock, Clock, DollarSign, ReceiptText, AlertTriangle } from "lucide-react";
import { requirePOSAccess } from "../../access";
import { requirePermission } from "@/lib/rbac";
import { getPOSReportSnapshots } from "../../actions";

export const dynamic = "force-dynamic";

export default async function POSZReportPage() {
  await requirePOSAccess();
  await requirePermission("pos.report.zReport");

  const snaps = (await getPOSReportSnapshots("Z", 30)) as any[];

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 2 }).format(n || 0);

  const fmtDate = (d: Date | string) =>
    new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(d));

  const varianceClass = (v: number) => {
    if (v == null) return "text-muted-foreground";
    if (Math.abs(v) < 1) return "text-emerald-700";
    if (v > 0) return "text-sky-700";
    return "text-rose-700 font-semibold";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/pos" className="rounded-full p-2 transition-colors hover:bg-accent">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">Z Reports</h1>
          <p className="text-sm text-muted-foreground">End-of-day reconciliation with variances — locks and closes the shift.</p>
        </div>
        <Link
          href="/pos"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-violet-500/40 bg-violet-500/5 text-violet-700 hover:bg-violet-500/10 text-sm font-medium"
        >
          <Lock className="h-4 w-4" />
          Close shift from POS Counter
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm flex items-center gap-3">
          <div className="rounded-lg bg-violet-500/10 text-violet-600 p-2">
            <ReceiptText className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground tracking-wide">Reports</div>
            <div className="text-lg font-semibold">{snaps.length}</div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm flex items-center gap-3">
          <div className="rounded-lg bg-emerald-500/10 text-emerald-600 p-2">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground tracking-wide">Latest net sales</div>
            <div className="text-lg font-semibold">
              {snaps[0]?.summaryJson ? fmtMoney(Number((snaps[0].summaryJson as any)?.netSales || 0)) : fmtMoney(0)}
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm flex items-center gap-3">
          <div className="rounded-lg bg-amber-500/10 text-amber-600 p-2">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground tracking-wide">Latest variance</div>
            <div className={`text-lg font-semibold ${snaps[0]?.summaryJson ? varianceClass(Number((snaps[0].summaryJson as any)?.totalVariance || 0)) : ""}`}>
              {snaps[0]?.summaryJson ? fmtMoney(Number((snaps[0].summaryJson as any)?.totalVariance || 0)) : fmtMoney(0)}
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm flex items-center gap-3">
          <div className="rounded-lg bg-slate-500/10 text-slate-600 p-2">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground tracking-wide">Latest closed</div>
            <div className="text-lg font-semibold">
              {snaps[0]?.generatedAt ? fmtDate(snaps[0].generatedAt) : "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Report #</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Closed</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Counter</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Gross</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Net Sales</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Cash Counted</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Cash Var.</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Total Var.</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {snaps.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    No Z Reports yet. Close a shift from the POS counter using the <span className="font-semibold text-foreground">Z Report</span> button.
                  </td>
                </tr>
              )}
              {snaps.map((s) => {
                const sum: any = s.summaryJson || {};
                const t: any = s.tenderBreakdownJson || {};
                return (
                  <tr key={s.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-violet-700 font-medium">{s.snapshotNumber}</td>
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {fmtDate(s.generatedAt)}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{sum.counterName || <span className="italic text-muted-foreground/60">—</span>}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{fmtMoney(Number(sum.grossSales || 0))}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-emerald-700">{fmtMoney(Number(sum.netSales || 0))}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{t.CASH?.counted != null ? fmtMoney(Number(t.CASH.counted)) : <span className="italic text-muted-foreground/60">—</span>}</td>
                    <td className={`px-4 py-2.5 text-right font-mono ${varianceClass(Number(t.CASH?.variance))}`}>
                      {t.CASH?.variance != null ? fmtMoney(Number(t.CASH.variance)) : <span className="italic text-muted-foreground/60">—</span>}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono ${varianceClass(Number(sum.totalVariance))}`}>
                      {sum.totalVariance != null ? fmtMoney(Number(sum.totalVariance)) : <span className="italic text-muted-foreground/60">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground max-w-[22ch] truncate" title={sum.closeNotes || ""}>
                      {sum.closeNotes || <span className="italic text-muted-foreground/60">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
