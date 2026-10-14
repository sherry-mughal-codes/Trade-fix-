import Link from "next/link";
import { Boxes, ClipboardList, Layers3, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireOrganizationId, withOrganization } from "@/lib/tenant-db";
import { requireInventoryAccess } from "./access";

export const dynamic = "force-dynamic";

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function InventoryOverviewPage() {
  await requireInventoryAccess("inventory.access");
  const organizationId = await requireOrganizationId();
  const [canManageStockEntry, canManageAdjustments, canViewBatches, canViewLedger] = await Promise.all([
    hasPermission("inventory.stockEntry.manage"),
    hasPermission("inventory.adjustments.manage"),
    hasPermission("inventory.batches.view"),
    hasPermission("inventory.ledger.view"),
  ]);

  const [inventoryItems, activeBatches, activeBatchCount, recentMovements, expiringBatches] = await Promise.all([
    prisma.item.findMany({
      where: withOrganization(organizationId, { itemType: "INVENTORY" }),
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        stockOnHand: true,
        movingAverageCost: true,
      },
    }),
    prisma.itemBatch.findMany({
      where: {
        organizationId,
        availableQty: { gt: 0 },
      },
      include: {
        item: {
          select: {
            name: true,
            defaultUnit: true,
          },
        },
      },
      orderBy: [{ expiryDate: "asc" }, { receivedDate: "asc" }],
      take: 8,
    }),
    prisma.itemBatch.count({
      where: {
        organizationId,
        availableQty: { gt: 0 },
      },
    }),
    prisma.stockMovement.findMany({
      where: { organizationId },
      include: {
        item: {
          select: {
            name: true,
            defaultUnit: true,
          },
        },
        invoice: {
          select: {
            invoiceNumber: true,
          },
        },
      },
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
    prisma.itemBatch.findMany({
      where: {
        organizationId,
        availableQty: { gt: 0 },
        expiryDate: {
          lte: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        },
      },
      include: {
        item: {
          select: {
            name: true,
            defaultUnit: true,
          },
        },
      },
      orderBy: { expiryDate: "asc" },
      take: 6,
    }),
  ]);

  const totalStockValue = inventoryItems.reduce(
    (sum, item) => sum + Number(item.stockOnHand || 0) * Number(item.movingAverageCost || 0),
    0,
  );
  const totalStockUnits = inventoryItems.reduce((sum, item) => sum + Number(item.stockOnHand || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Inventory Control</h1>
          <p className="text-sm text-muted-foreground">
            Track opening stock, receipts, batch balances, and stock consumption from invoices.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canManageStockEntry ? (
            <Link
              href="/inventory/stock-entry"
              className="inline-flex items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              <Plus className="mr-2 h-4 w-4" />
              Stock Entry
            </Link>
          ) : null}
          {canManageAdjustments ? (
            <Link
              href="/inventory/adjustments"
              className="inline-flex items-center justify-center rounded-md bg-minia-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-minia-primary/90"
            >
              <ClipboardList className="mr-2 h-4 w-4" />
              Adjust Stock
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Inventory Items</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{inventoryItems.length.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Stock On Hand</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{formatNumber(totalStockUnits)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Batch Lines</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{activeBatchCount.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Stock Value</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{formatNumber(totalStockValue)}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Current Stock Summary</h2>
                <p className="text-sm text-muted-foreground">Live stock and moving average per item.</p>
              </div>
              <Link href="/items" className="text-sm font-medium text-minia-primary hover:underline">
                View Items
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-5 py-3 font-medium text-muted-foreground">Item</th>
                    <th className="px-5 py-3 text-right font-medium text-muted-foreground">Stock</th>
                    <th className="px-5 py-3 text-right font-medium text-muted-foreground">Avg Cost</th>
                    <th className="px-5 py-3 text-right font-medium text-muted-foreground">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {inventoryItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-6 text-center text-muted-foreground">
                        No inventory items available yet.
                      </td>
                    </tr>
                  ) : (
                    inventoryItems.map((item) => (
                      <tr key={item.id}>
                        <td className="px-5 py-3 font-medium text-foreground">{item.name}</td>
                        <td className="px-5 py-3 text-right text-foreground">{formatNumber(Number(item.stockOnHand || 0))}</td>
                        <td className="px-5 py-3 text-right text-foreground">{formatNumber(Number(item.movingAverageCost || 0))}</td>
                        <td className="px-5 py-3 text-right font-medium text-foreground">
                          {formatNumber(Number(item.stockOnHand || 0) * Number(item.movingAverageCost || 0))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Recent Stock Activity</h2>
                <p className="text-sm text-muted-foreground">Latest manual entries and invoice-driven stock movements.</p>
              </div>
              {canViewLedger ? (
                <Link href="/inventory/ledger" className="text-sm font-medium text-minia-primary hover:underline">
                  Full Ledger
                </Link>
              ) : null}
            </div>
            <div className="divide-y divide-border">
              {recentMovements.length === 0 ? (
                <div className="px-5 py-6 text-center text-sm text-muted-foreground">No stock movements posted yet.</div>
              ) : (
                recentMovements.map((movement) => (
                  <div key={movement.id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div>
                      <div className="font-medium text-foreground">{movement.item?.name || "Item"}</div>
                      <div className="text-xs text-muted-foreground">
                        {movement.movementType.replace(/_/g, " ")} • {new Date(movement.transactionDate).toLocaleDateString()}
                        {movement.invoice?.invoiceNumber ? ` • ${movement.invoice.invoiceNumber}` : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-medium ${movement.direction === "IN" ? "text-minia-success" : "text-minia-danger"}`}>
                        {movement.direction === "IN" ? "+" : "-"}{formatNumber(Number(movement.quantity || 0))}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Balance {formatNumber(Number(movement.runningQty || 0))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-minia-primary/10 text-minia-primary">
                <Layers3 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Expiring Soon</h2>
                <p className="text-sm text-muted-foreground">Batches within the next 30 days.</p>
              </div>
            </div>
            <div className="space-y-3">
              {expiringBatches.length === 0 ? (
                <p className="text-sm text-muted-foreground">No batches expiring in the next 30 days.</p>
              ) : (
                expiringBatches.map((batch) => (
                  <div key={batch.id} className="rounded-lg border border-border bg-accent/30 p-3">
                    <div className="font-medium text-foreground">{batch.item?.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {batch.batchNumber || "No batch"} • {batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : "No expiry"}
                    </div>
                    <div className="mt-1 text-sm text-foreground">
                      Available {formatNumber(Number(batch.availableQty || 0))} {batch.item?.defaultUnit || ""}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-minia-primary/10 text-minia-primary">
                <Boxes className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Quick Links</h2>
                <p className="text-sm text-muted-foreground">Move around the inventory workflow quickly.</p>
              </div>
            </div>
            <div className="grid gap-3">
              {canManageStockEntry ? (
                <Link href="/inventory/stock-entry" className="rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-accent">
                  Manual Stock Entry
                </Link>
              ) : null}
              {canManageAdjustments ? (
                <Link href="/inventory/adjustments" className="rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-accent">
                  Stock Adjustments
                </Link>
              ) : null}
              {canViewBatches ? (
                <Link href="/inventory/batches" className="rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-accent">
                  Batch Availability
                </Link>
              ) : null}
              {canViewLedger ? (
                <Link href="/inventory/ledger" className="rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-accent">
                  Stock Ledger
                </Link>
              ) : null}
              <Link href="/invoices" className="rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-accent">
                Invoices
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
