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

export default async function StockAdjustmentsPage() {
  await requireInventoryAccess("inventory.adjustments.manage");
  const organizationId = await requireOrganizationId();

  const adjustments = await prisma.stockAdjustment.findMany({
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
          <h1 className="text-xl font-semibold text-foreground">Stock Adjustments</h1>
          <p className="text-sm text-muted-foreground">
            Review adjustment documents first, then create new multi-item increase or decrease entries from a dedicated form.
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
            href="/inventory/adjustments/new"
            className="inline-flex items-center justify-center rounded-md bg-minia-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-minia-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add New Adjustment
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-5 py-3 font-medium text-muted-foreground">Adjustment No.</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Date</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Direction</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Items</th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">Total Qty</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {adjustments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">
                    No stock adjustments posted yet.
                  </td>
                </tr>
              ) : (
                adjustments.map((adjustment) => {
                  const totalQty = adjustment.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
                  return (
                    <tr key={adjustment.id}>
                      <td className="px-5 py-4 font-medium text-foreground">{adjustment.adjustmentNumber}</td>
                      <td className="px-5 py-4 text-foreground">{new Date(adjustment.date).toLocaleDateString()}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${adjustment.adjustmentType === "IN" ? "bg-minia-success/10 text-minia-success" : "bg-minia-danger/10 text-minia-danger"}`}>
                          {adjustment.adjustmentType === "IN" ? "Increase" : "Decrease"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-foreground">
                        <div className="space-y-1">
                          {adjustment.items.slice(0, 3).map((item) => (
                            <div key={item.id} className="text-sm">
                              {item.item.name}
                              <span className="text-xs text-muted-foreground"> • {formatNumber(Number(item.quantity || 0))} {item.item.defaultUnit}</span>
                            </div>
                          ))}
                          {adjustment.items.length > 3 ? (
                            <div className="text-xs text-muted-foreground">+{adjustment.items.length - 3} more items</div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right font-medium text-foreground">{formatNumber(totalQty)}</td>
                      <td className="px-5 py-4 text-muted-foreground">{adjustment.note || "-"}</td>
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
