import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/tenant-db";
import { requireInventoryAccess } from "../access";

export const dynamic = "force-dynamic";

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function StockEntryPage() {
  await requireInventoryAccess("inventory.stockEntry.manage");
  const organizationId = await requireOrganizationId();

  const entries = await prisma.stockEntry.findMany({
    where: { organizationId },
    include: {
      items: {
        include: {
          item: {
            select: {
              name: true,
              defaultUnit: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Stock Entry</h1>
          <p className="text-sm text-muted-foreground">
            Review all opening stock and inward stock documents, then create new entries from a dedicated multi-item screen.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/inventory"
            className="inline-flex items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Back to Inventory
          </Link>
          <Link
            href="/inventory/stock-entry/new"
            className="inline-flex items-center justify-center rounded-md bg-minia-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-minia-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add New Entry
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-5 py-3 font-medium text-muted-foreground">Entry No.</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Date</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Type</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Items</th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">Total Qty</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">
                    No stock entries posted yet.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const totalQty = entry.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
                  return (
                    <tr key={entry.id}>
                      <td className="px-5 py-4 font-medium text-foreground">{entry.entryNumber}</td>
                      <td className="px-5 py-4 text-foreground">{new Date(entry.date).toLocaleDateString()}</td>
                      <td className="px-5 py-4 text-foreground">{entry.entryType === "OPENING" ? "Opening Stock" : "Stock Receipt"}</td>
                      <td className="px-5 py-4 text-foreground">
                        <div className="space-y-1">
                          {entry.items.slice(0, 3).map((item) => (
                            <div key={item.id} className="text-sm">
                              {item.item.name}
                              <span className="text-xs text-muted-foreground"> • {formatNumber(Number(item.quantity || 0))} {item.item.defaultUnit}</span>
                            </div>
                          ))}
                          {entry.items.length > 3 ? (
                            <div className="text-xs text-muted-foreground">+{entry.items.length - 3} more items</div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right font-medium text-foreground">{formatNumber(totalQty)}</td>
                      <td className="px-5 py-4 text-muted-foreground">{entry.note || "-"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
