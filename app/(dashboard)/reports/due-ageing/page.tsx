import { prisma } from "@/lib/prisma";
import { differenceInCalendarDays } from "date-fns";
import { requirePageAccess } from "@/lib/rbac";
import { requireOrganizationContext } from "@/lib/tenancy";

const prismaAny = prisma as any;

type Bucket = { from: number; to: number; label: string };

function normalizeThresholds(values: number[]) {
  const cleaned = values
    .map((v) => (Number.isFinite(v) ? Math.floor(v) : 0))
    .map((v) => (v < 0 ? 0 : v))
    .sort((a, b) => a - b);

  const out: number[] = [];
  for (const v of cleaned) {
    if (out.length === 0) {
      out.push(v);
      continue;
    }
    const prev = out[out.length - 1];
    out.push(v <= prev ? prev + 1 : v);
  }
  return out;
}

function buildBuckets(t1: number, t2: number, t3: number): Bucket[] {
  const [a, b, c] = normalizeThresholds([t1, t2, t3]);
  return [
    { from: 0, to: a, label: `0-${a}` },
    { from: a + 1, to: b, label: `${a + 1}-${b}` },
    { from: b + 1, to: c, label: `${b + 1}-${c}` },
    { from: c + 1, to: 9999, label: `${c}+` },
  ];
}

function bucketForAge(days: number, buckets: Bucket[]) {
  for (const b of buckets) {
    if (days >= b.from && days <= b.to) return b.label;
  }
  return "Other";
}

export default async function DueAgeingReport({
  searchParams,
}: {
  searchParams?: { b1?: string; b2?: string; b3?: string };
}) {
  await requirePageAccess("reports.dueAgeing", "/reports");
  const organizationId = (await requireOrganizationContext()).activeOrganizationId!;
  const defaultB1 = 7;
  const defaultB2 = 15;
  const defaultB3 = 21;

  const b1 = Number(searchParams?.b1 ?? defaultB1);
  const b2 = Number(searchParams?.b2 ?? defaultB2);
  const b3 = Number(searchParams?.b3 ?? defaultB3);
  const buckets = buildBuckets(b1, b2, b3);

  const invoices = await prismaAny.invoice.findMany({
    where: {
      organizationId,
      type: "SALE",
      status: { notIn: ["DRAFT", "CANCELLED"] },
      balanceAmount: { gt: 0 },
    },
    include: { party: true },
    orderBy: { dueDate: "asc" },
  });

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const rows = (invoices as any[]).map((inv) => {
    const due = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.date);
    const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const daysOverdue = Math.max(0, differenceInCalendarDays(todayStart, dueStart));
    const bucket = bucketForAge(daysOverdue, buckets);
    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      patient: inv.party?.name || "-",
      dueDate: inv.dueDate,
      currency: inv.currency,
      balance: Number(inv.balanceAmount || 0),
      daysOverdue,
      bucket,
    };
  });

  const totals = new Map<string, { count: number; balance: number }>();
  for (const r of rows) {
    const existing = totals.get(r.bucket);
    if (existing) {
      existing.count += 1;
      existing.balance += r.balance;
    } else {
      totals.set(r.bucket, { count: 1, balance: r.balance });
    }
  }

  const bucketOrder = new Map<string, number>();
  for (let i = 0; i < buckets.length; i++) bucketOrder.set(buckets[i].label, i);
  const summary = Array.from(totals.entries()).sort((a, b) => {
    const ai = bucketOrder.has(a[0]) ? bucketOrder.get(a[0])! : 999;
    const bi = bucketOrder.has(b[0]) ? bucketOrder.get(b[0])! : 999;
    return ai - bi;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Due Ageing</h1>
        <p className="text-sm text-muted-foreground">Overall due invoices with ageing buckets</p>
      </div>

      <form className="bg-card p-4 rounded-lg shadow-sm border border-border flex flex-col md:flex-row gap-3 items-start md:items-end" method="get">
        <div className="flex-1 space-y-2">
          <label className="text-sm font-medium text-foreground">Ageing Buckets</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Bucket 1 End</div>
              <input
                type="number"
                name="b1"
                min={0}
                defaultValue={Number.isFinite(b1) ? Math.floor(b1) : defaultB1}
                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-transparent"
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Bucket 2 End</div>
              <input
                type="number"
                name="b2"
                min={0}
                defaultValue={Number.isFinite(b2) ? Math.floor(b2) : defaultB2}
                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-transparent"
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Bucket 3 End</div>
              <input
                type="number"
                name="b3"
                min={0}
                defaultValue={Number.isFinite(b3) ? Math.floor(b3) : defaultB3}
                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-transparent"
              />
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Ranges will be: 0-b1, (b1+1)-b2, (b2+1)-b3, (b3+1)+
          </div>
        </div>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-minia-primary rounded-md hover:brightness-95"
        >
          Apply
        </button>
      </form>

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="text-sm font-semibold text-foreground">Summary</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-medium text-muted-foreground">Bucket</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Invoices</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Total Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {summary.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-muted-foreground">
                    No due invoices
                  </td>
                </tr>
              ) : (
                summary.map(([label, v]) => (
                  <tr key={label} className="hover:bg-accent/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{label}</td>
                    <td className="px-6 py-4 text-foreground">{v.count}</td>
                    <td className="px-6 py-4 text-foreground">{Number(v.balance).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="text-sm font-semibold text-foreground">Invoices</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-medium text-muted-foreground">Invoice #</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Customer</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Due Date</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Days Overdue</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Bucket</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                    No due invoices
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-accent/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{r.invoiceNumber}</td>
                    <td className="px-6 py-4 text-foreground">{r.patient}</td>
                    <td className="px-6 py-4 text-foreground">
                      {r.dueDate ? new Date(r.dueDate).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-6 py-4 text-foreground">{r.daysOverdue}</td>
                    <td className="px-6 py-4 text-foreground">{r.bucket}</td>
                    <td className="px-6 py-4 text-foreground">{r.currency} {r.balance.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
