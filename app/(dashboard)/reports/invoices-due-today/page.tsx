import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/rbac";
import { requireOrganizationContext } from "@/lib/tenancy";

const prismaAny = prisma as any;

function getTimeZoneOffsetMinutes(timeZone: string, date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    year: "numeric",
  }).formatToParts(date);

  const tz = parts.find((p) => p.type === "timeZoneName")?.value || "GMT";
  const match = tz.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!match) return 0;

  const sign = match[1] === "-" ? -1 : 1;
  const hours = parseInt(match[2], 10);
  const mins = match[3] ? parseInt(match[3], 10) : 0;
  return sign * (hours * 60 + mins);
}

function getDayRangeUtc(timeZone: string, date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);

  let startUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  for (let i = 0; i < 2; i++) {
    const offset = getTimeZoneOffsetMinutes(timeZone, startUtc);
    startUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - offset * 60_000);
  }

  let endUtc = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0));
  for (let i = 0; i < 2; i++) {
    const offset = getTimeZoneOffsetMinutes(timeZone, endUtc);
    endUtc = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0) - offset * 60_000);
  }

  return { startUtc, endUtc, y, m, d };
}

export default async function InvoicesDueTodayReport() {
  await requirePageAccess("reports.invoicesDueToday", "/reports");
  const organizationId = (await requireOrganizationContext()).activeOrganizationId!;
  const reportTimeZone = process.env.REPORT_TIMEZONE || "Asia/Karachi";
  const now = new Date();
  const { startUtc: start, endUtc: end, y, m, d } = getDayRangeUtc(reportTimeZone, now);

  const invoices = await prismaAny.invoice.findMany({
    where: {
      organizationId,
      type: "SALE",
      status: { notIn: ["DRAFT", "CANCELLED"] },
      balanceAmount: { gt: 0 },
      dueDate: { gte: start, lt: end },
    },
    include: { party: true },
    orderBy: { dueDate: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Invoices Due Today</h1>
        <p className="text-sm text-muted-foreground">
          Invoices due on {`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`} ({reportTimeZone}) with balance due
        </p>
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-medium text-muted-foreground">Invoice #</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Customer</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Due Date</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                    No invoices due today
                  </td>
                </tr>
              ) : (
                invoices.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-accent/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{inv.invoiceNumber}</td>
                    <td className="px-6 py-4 text-foreground">{inv.party?.name || "-"}</td>
                    <td className="px-6 py-4 text-foreground">
                      {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-6 py-4 text-foreground">
                      {inv.currency} {Number(inv.balanceAmount || 0).toLocaleString()}
                    </td>
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
