import Link from "next/link";
import { ArrowLeft, BarChart3, Clock, DollarSign, ReceiptText, Radio, User, Store, ArrowUpRight } from "lucide-react";
import { requirePOSAccess } from "../../access";
import { requirePermission, getPermissionContext } from "@/lib/rbac";
import { getPOSReportSnapshots } from "../../actions";
import { requireOrganizationId, withOrganization } from "@/lib/tenant-db";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function POSXReportPage() {
  await requirePOSAccess();
  await requirePermission("pos.report.xReport");

  const organizationId = await requireOrganizationId();
  const ctx = await getPermissionContext();
  const userId = ctx.userId;

  const [snaps, openShifts] = await Promise.all([
    getPOSReportSnapshots("X", 30) as Promise<any[]>,
    prisma.cashierShift.findMany({
      where: withOrganization(organizationId, {
        ...(ctx.isSuperadmin || ctx.permissions.includes("pos.profile.manage") ? {} : { userId }),
        status: "OPEN",
      }),
      include: {
        posProfile: {
          include: {
            posCounter: true,
          },
        },
        user: {
          select: { name: true, email: true },
        },
      },
      orderBy: { openedAt: "desc" },
    }),
  ]);

  const openShiftsWithStats = await Promise.all(
    openShifts.map(async (shift) => {
      const invoices = await prisma.invoice.findMany({
        where: withOrganization(organizationId, {
          cashierShiftId: shift.id,
          isPos: true,
          status: { not: "CANCELLED" },
        }),
        include: {
          payments: true,
          items: true,
        },
      });
      const refunds = await prisma.pOSRefund.findMany({
        where: withOrganization(organizationId, { cashierShiftId: shift.id }),
      });

      const grossSales = invoices.reduce((s, inv) => s + (inv.subTotal || 0), 0);
      const discountTotal = invoices.reduce((s, inv) => s + (inv.discountTotal || 0), 0);
      const refundTotal = refunds.reduce((s, r) => s + (r.grandTotal || 0), 0);
      const netSales = grossSales - discountTotal - refundTotal;
      const billsCount = invoices.length;
      const tenderMap: Record<string, number> = { CASH: 0, CARD: 0, BANK: 0, WALLET: 0, CREDIT: 0 };
      for (const inv of invoices) {
        const invPaid = inv.payments || [];
        const isCredit = invPaid.length === 0 && (inv.balanceAmount || 0) > 0.001;
        if (isCredit) {
          tenderMap.CREDIT += (inv.grandTotal || 0);
          continue;
        }
        for (const p of invPaid) {
          const m = String(p.method || "CASH").toUpperCase();
          tenderMap[m] = (tenderMap[m] || 0) + Math.abs(Number(p.amount) || 0);
        }
      }
      const cashExpected = (shift.openingFloat || 0) + (tenderMap.CASH || 0);

      return {
        ...shift,
        stats: {
          grossSales,
          discountTotal,
          refundTotal,
          netSales,
          billsCount,
          refundCount: refunds.length,
          cashExpected,
          tenderMap,
        },
      };
    })
  );

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

  const totalActiveNetSales = openShiftsWithStats.reduce((sum, s) => sum + s.stats.netSales, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/pos" className="rounded-full p-2 transition-colors hover:bg-accent">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">X Reports</h1>
          <p className="text-sm text-muted-foreground">Mid-shift live readings and saved snapshots — shift remains open after each run.</p>
        </div>
        <Link
          href="/pos"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-sky-500/40 bg-sky-500/5 text-sky-700 hover:bg-sky-500/10 text-sm font-medium"
        >
          <BarChart3 className="h-4 w-4" />
          Generate from POS Counter
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm flex items-center gap-3">
          <div className={`rounded-lg p-2 ${openShiftsWithStats.length > 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-sky-500/10 text-sky-600"}`}>
            <Radio className={`h-5 w-5 ${openShiftsWithStats.length > 0 ? "animate-pulse" : ""}`} />
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground tracking-wide">Active Open Shifts</div>
            <div className="text-lg font-semibold">{openShiftsWithStats.length}</div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm flex items-center gap-3">
          <div className="rounded-lg bg-emerald-500/10 text-emerald-600 p-2">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground tracking-wide">
              {openShiftsWithStats.length > 0 ? "Active shift net sales" : "Latest snapshot net sales"}
            </div>
            <div className="text-lg font-semibold text-emerald-700">
              {openShiftsWithStats.length > 0
                ? fmtMoney(totalActiveNetSales)
                : snaps[0]?.summaryJson
                ? fmtMoney(Number((snaps[0].summaryJson as any)?.netSales || 0))
                : fmtMoney(0)}
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm flex items-center gap-3">
          <div className="rounded-lg bg-sky-500/10 text-sky-600 p-2">
            <ReceiptText className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground tracking-wide">Saved Snapshots</div>
            <div className="text-lg font-semibold">{snaps.length}</div>
          </div>
        </div>
      </div>

      {openShiftsWithStats.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <h2 className="text-base font-semibold text-foreground">Active Shift (Live Mid-Shift Reading)</h2>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {openShiftsWithStats.map((shift) => (
              <div key={shift.id} className="rounded-xl border-2 border-emerald-500/30 bg-card p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 border border-emerald-500/30">
                      LIVE OPEN
                    </span>
                    <span className="font-mono text-sm font-semibold text-foreground">{shift.shiftNumber}</span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Store className="h-3.5 w-3.5" />
                      {shift.counterName || shift.posProfile?.posCounter?.name || "Counter"}
                    </span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      {shift.user?.name || "Cashier"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      Opened {fmtDate(shift.openedAt)}
                    </span>
                    <Link
                      href="/pos"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors"
                    >
                      Counter
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-center">
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Opening Float</div>
                    <div className="text-sm font-semibold text-foreground mt-1 font-mono">{fmtMoney(shift.openingFloat || 0)}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Gross Sales</div>
                    <div className="text-sm font-semibold text-foreground mt-1 font-mono">{fmtMoney(shift.stats.grossSales)}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Discounts</div>
                    <div className="text-sm font-semibold text-amber-600 mt-1 font-mono">-{fmtMoney(shift.stats.discountTotal)}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Refunds</div>
                    <div className="text-sm font-semibold text-rose-600 mt-1 font-mono">-{fmtMoney(shift.stats.refundTotal)}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <div className="text-[11px] uppercase tracking-wider text-emerald-800 dark:text-emerald-300 font-semibold">Net Sales</div>
                    <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-1 font-mono">{fmtMoney(shift.stats.netSales)}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Cash Expected</div>
                    <div className="text-sm font-semibold text-foreground mt-1 font-mono">{fmtMoney(shift.stats.cashExpected)}</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50 text-xs">
                  <span className="text-muted-foreground font-medium mr-1">Tender Breakdown:</span>
                  <span className="px-2 py-0.5 rounded bg-muted font-mono">Cash: {fmtMoney(shift.stats.tenderMap.CASH)}</span>
                  <span className="px-2 py-0.5 rounded bg-muted font-mono">Card: {fmtMoney(shift.stats.tenderMap.CARD)}</span>
                  <span className="px-2 py-0.5 rounded bg-muted font-mono">Bank: {fmtMoney(shift.stats.tenderMap.BANK)}</span>
                  <span className="px-2 py-0.5 rounded bg-muted font-mono">Wallet: {fmtMoney(shift.stats.tenderMap.WALLET)}</span>
                  {shift.stats.tenderMap.CREDIT > 0 && (
                    <span className="px-2 py-0.5 rounded bg-muted font-mono">Credit: {fmtMoney(shift.stats.tenderMap.CREDIT)}</span>
                  )}
                  <span className="ml-auto text-muted-foreground">
                    {shift.stats.billsCount} {shift.stats.billsCount === 1 ? "bill" : "bills"} issued
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Saved X-Report Snapshots</h2>
        <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Snapshot #</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Generated</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Counter</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Gross</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Discounts</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Refunds</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Net Sales</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Cash Expected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {snaps.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      No saved X Reports yet. Generate one from the POS counter using the <span className="font-semibold text-foreground">X Report</span> button.
                    </td>
                  </tr>
                )}
                {snaps.map((s) => {
                  const sum: any = s.summaryJson || {};
                  const t: any = s.tenderBreakdownJson || {};
                  return (
                    <tr key={s.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-mono text-sky-700 font-medium">
                        <div className="flex items-center gap-1.5">
                          <span>{s.snapshotNumber}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {fmtDate(s.generatedAt)}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{sum.counterName || <span className="italic text-muted-foreground/60">—</span>}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{fmtMoney(Number(sum.grossSales || 0))}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-amber-600">-{fmtMoney(Number(sum.discountTotal || 0))}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-rose-600">-{fmtMoney(Number(sum.refundTotal || 0))}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-emerald-700">{fmtMoney(Number(sum.netSales || 0))}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{fmtMoney(Number(t.CASH?.expected || 0))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
