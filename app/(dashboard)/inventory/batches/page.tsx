import Link from "next/link";
import SearchInput from "@/components/ui/search";
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

export default async function InventoryBatchesPage({
  searchParams,
}: {
  searchParams?: { query?: string };
}) {
  await requireInventoryAccess("inventory.batches.view");
  const organizationId = await requireOrganizationId();
  const query = searchParams?.query || "";

  const allBatches = await prisma.itemBatch.findMany({
    where: {
      organizationId,
      availableQty: { gt: 0 },
      AND: [{ batchNumber: { not: null } }, { batchNumber: { not: "" } }],
    },
    include: {
      item: {
        select: {
          name: true,
          itemCode: true,
          defaultUnit: true,
          hasExpiry: true,
          trackBatches: true,
        },
      },
    },
    orderBy: [
      { expiryDate: "asc" },
      { receivedDate: "asc" },
      { createdAt: "asc" },
    ],
  });
  const batches = query
    ? allBatches.filter((batch) => {
        const lookup = `${batch.item?.name || ""} ${batch.item?.itemCode || ""}`.toLowerCase();
        return lookup.includes(query.toLowerCase());
      })
    : allBatches;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Batch Availability</h1>
          <p className="text-sm text-muted-foreground">
            Live batch balances after FEFO consumption and inward stock postings.
          </p>
        </div>
        <Link
          href="/inventory"
          className="inline-flex items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Back to Inventory
        </Link>
      </div>

      <div className="flex flex-col items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 shadow-sm sm:flex-row">
        <SearchInput placeholder="Search items or item code..." />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-5 py-3 font-medium text-muted-foreground">Item</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Batch</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Expiry</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Warehouse</th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">Original Qty</th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">Available Qty</th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">Unit Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-6 text-center text-muted-foreground">
                    No batch balances found.
                  </td>
                </tr>
              ) : (
                batches.map((batch) => (
                  <tr key={batch.id}>
                    <td className="px-5 py-3">
                      <div className="font-medium text-foreground">{batch.item?.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {batch.item?.itemCode || "No code"} • {batch.item?.defaultUnit || ""}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-foreground">{batch.batchNumber}</td>
                    <td className="px-5 py-3 text-foreground">
                      {batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : "No expiry"}
                    </td>
                    <td className="px-5 py-3 text-foreground">{batch.warehouseName || "No label"}</td>
                    <td className="px-5 py-3 text-right text-foreground">{formatNumber(Number(batch.originalQty || 0))}</td>
                    <td className="px-5 py-3 text-right font-medium text-foreground">{formatNumber(Number(batch.availableQty || 0))}</td>
                    <td className="px-5 py-3 text-right text-foreground">{formatNumber(Number(batch.unitCost || 0))}</td>
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
