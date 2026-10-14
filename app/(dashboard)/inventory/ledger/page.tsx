import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/tenant-db";
import { requireInventoryAccess } from "../access";
import LedgerFilters from "./ledger-filters";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

function formatDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: Date | string) {
  return new Date(value).toLocaleDateString();
}

function formatMovementLabel(value: string) {
  return value.replace(/_/g, " ");
}

function getOpeningQty(movement: { direction: string; quantity: number; runningQty: number }) {
  return movement.direction === "IN"
    ? Number(movement.runningQty || 0) - Number(movement.quantity || 0)
    : Number(movement.runningQty || 0) + Number(movement.quantity || 0);
}

function buildPageHref(params: {
  itemId?: string;
  from?: string;
  to?: string;
  movementType?: string;
  sourceType?: string;
  page: number;
}) {
  const query = new URLSearchParams();

  if (params.itemId) query.set("itemId", params.itemId);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.movementType) query.set("movementType", params.movementType);
  if (params.sourceType) query.set("sourceType", params.sourceType);
  if (params.page > 1) query.set("page", String(params.page));

  const search = query.toString();
  return search ? `/inventory/ledger?${search}` : "/inventory/ledger";
}

type LedgerSearchParams = {
  itemId?: string;
  from?: string;
  to?: string;
  movementType?: string;
  sourceType?: string;
  page?: string;
};

export default async function InventoryLedgerPage({
  searchParams,
}: {
  searchParams?: LedgerSearchParams;
}) {
  await requireInventoryAccess("inventory.ledger.view");
  const organizationId = await requireOrganizationId();

  const today = new Date();
  const defaultTo = formatDateInput(today);
  const defaultFromDate = new Date(today);
  defaultFromDate.setDate(defaultFromDate.getDate() - 29);
  const defaultFrom = formatDateInput(defaultFromDate);

  const itemId = searchParams?.itemId || "";
  const from = searchParams?.from || defaultFrom;
  const to = searchParams?.to || defaultTo;
  const movementType = searchParams?.movementType || "";
  const sourceType = searchParams?.sourceType || "";
  const page = Math.max(1, Number(searchParams?.page) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const inventoryItems = await prisma.item.findMany({
    where: {
      organizationId,
      itemType: "INVENTORY",
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      itemCode: true,
      defaultUnit: true,
    },
    orderBy: { name: "asc" },
  });

  const selectedItem = inventoryItems.find((item) => item.id === itemId) || null;

  const whereClause: Record<string, unknown> = {
    organizationId,
  };

  if (selectedItem) {
    whereClause.itemId = selectedItem.id;
  }

  if (movementType) {
    whereClause.movementType = movementType;
  }

  if (sourceType) {
    whereClause.sourceType = sourceType;
  }

  if (from || to) {
    whereClause.transactionDate = {
      ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
    };
  }

  let totalCount = 0;
  let totalPages = 0;
  let openingQty = 0;
  let closingQty = 0;
  let totalInQty = 0;
  let totalOutQty = 0;
  let closingAverageCost = 0;
  let groupedMovements: Array<{
    key: string;
    reference: string;
    sourceLabel: string;
    postedOn: string;
    note: string;
    inQty: number;
    outQty: number;
    closingQty: number;
    rows: Array<{
      id: string;
      transactionDate: Date;
      movementType: string;
      batchNumber: string | null;
      warehouseName: string | null;
      note: string | null;
      direction: string;
      quantity: number;
      runningQty: number;
      runningAverageCost: number;
    }>;
  }> = [];

  if (selectedItem) {
    const [movements, count, firstMovement, lastMovement, totalIn, totalOut] = await Promise.all([
      prisma.stockMovement.findMany({
        where: whereClause as any,
        include: {
          invoice: {
            select: {
              invoiceNumber: true,
            },
          },
        },
        orderBy: [
          { transactionDate: "asc" },
          { createdAt: "asc" },
        ],
        skip,
        take: PAGE_SIZE,
      }),
      prisma.stockMovement.count({
        where: whereClause as any,
      }),
      prisma.stockMovement.findFirst({
        where: whereClause as any,
        orderBy: [
          { transactionDate: "asc" },
          { createdAt: "asc" },
        ],
      }),
      prisma.stockMovement.findFirst({
        where: whereClause as any,
        orderBy: [
          { transactionDate: "desc" },
          { createdAt: "desc" },
        ],
      }),
      prisma.stockMovement.aggregate({
        where: {
          ...(whereClause as any),
          direction: "IN",
        },
        _sum: {
          quantity: true,
        },
      }),
      prisma.stockMovement.aggregate({
        where: {
          ...(whereClause as any),
          direction: "OUT",
        },
        _sum: {
          quantity: true,
        },
      }),
    ]);

    totalCount = count;
    totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    totalInQty = Number(totalIn._sum.quantity || 0);
    totalOutQty = Number(totalOut._sum.quantity || 0);
    openingQty = firstMovement
      ? getOpeningQty({
          direction: firstMovement.direction,
          quantity: Number(firstMovement.quantity || 0),
          runningQty: Number(firstMovement.runningQty || 0),
        })
      : 0;
    closingQty = Number(lastMovement?.runningQty || 0);
    closingAverageCost = Number(lastMovement?.runningAverageCost || 0);

    const groupedMap = new Map<string, (typeof groupedMovements)[number]>();

    for (const movement of movements) {
      const key = `${movement.sourceType}:${movement.sourceId || movement.sourceNumber || movement.id}`;
      const existingGroup = groupedMap.get(key);
      const reference = movement.invoice?.invoiceNumber || movement.sourceNumber || "Manual Entry";
      const row = {
        id: movement.id,
        transactionDate: movement.transactionDate,
        movementType: movement.movementType,
        batchNumber: movement.batchNumber,
        warehouseName: movement.warehouseName,
        note: movement.note,
        direction: movement.direction,
        quantity: Number(movement.quantity || 0),
        runningQty: Number(movement.runningQty || 0),
        runningAverageCost: Number(movement.runningAverageCost || 0),
      };

      if (!existingGroup) {
        groupedMap.set(key, {
          key,
          reference,
          sourceLabel: formatMovementLabel(movement.sourceType),
          postedOn: formatDate(movement.transactionDate),
          note: movement.note || "",
          inQty: movement.direction === "IN" ? Number(movement.quantity || 0) : 0,
          outQty: movement.direction === "OUT" ? Number(movement.quantity || 0) : 0,
          closingQty: Number(movement.runningQty || 0),
          rows: [row],
        });
        continue;
      }

      existingGroup.rows.push(row);
      existingGroup.inQty += movement.direction === "IN" ? Number(movement.quantity || 0) : 0;
      existingGroup.outQty += movement.direction === "OUT" ? Number(movement.quantity || 0) : 0;
      existingGroup.closingQty = Number(movement.runningQty || 0);
      if (!existingGroup.note && movement.note) {
        existingGroup.note = movement.note;
      }
    }

    groupedMovements = Array.from(groupedMap.values());
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Stock Ledger</h1>
          <p className="text-sm text-muted-foreground">
            Review one item at a time with opening, movement totals, closing balance, and grouped document history.
          </p>
        </div>
        <Link
          href="/inventory"
          className="inline-flex items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Back to Inventory
        </Link>
      </div>

      <LedgerFilters
        itemOptions={inventoryItems.map((item) => ({
          value: item.id,
          label: item.itemCode ? `${item.name} (${item.itemCode})` : item.name,
        }))}
        initialItemId={itemId}
        initialFrom={from}
        initialTo={to}
        initialMovementType={movementType}
        initialSourceType={sourceType}
      />

      {!selectedItem ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Start with an item</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The ledger is now item-focused so it stays readable even when stock movements grow large.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Select an inventory item above to see opening stock, total in, total out, closing stock, and grouped movement history.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{selectedItem.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedItem.itemCode || "No code"}{selectedItem.defaultUnit ? ` • ${selectedItem.defaultUnit}` : ""}
                </p>
              </div>
              <div className="text-sm text-muted-foreground">
                Showing {totalCount === 0 ? 0 : skip + 1}-{Math.min(skip + PAGE_SIZE, totalCount)} of {totalCount} movements
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="text-sm text-muted-foreground">Opening Stock</div>
              <div className="mt-2 text-lg font-semibold text-foreground">{formatNumber(openingQty)}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="text-sm text-muted-foreground">Total In</div>
              <div className="mt-2 text-lg font-semibold text-minia-success">{formatNumber(totalInQty)}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="text-sm text-muted-foreground">Total Out</div>
              <div className="mt-2 text-lg font-semibold text-minia-danger">{formatNumber(totalOutQty)}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="text-sm text-muted-foreground">Closing Stock</div>
              <div className="mt-2 text-lg font-semibold text-foreground">{formatNumber(closingQty)}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="text-sm text-muted-foreground">Avg Cost</div>
              <div className="mt-2 text-lg font-semibold text-foreground">{formatNumber(closingAverageCost)}</div>
            </div>
          </div>

          {totalCount === 0 ? (
            <div className="rounded-lg border border-border bg-card p-10 text-center shadow-sm">
              <p className="text-sm text-muted-foreground">
                No stock movements found for the selected filters.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedMovements.map((group) => (
                <div key={group.key} className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                  <div className="border-b border-border bg-muted/30 px-5 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-base font-semibold text-foreground">{group.reference}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {group.sourceLabel} • {group.postedOn}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {group.note || "No additional note"}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm lg:min-w-[320px]">
                        <div className="text-right">
                          <div className="text-muted-foreground">In</div>
                          <div className="font-medium text-minia-success">{formatNumber(group.inQty)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-muted-foreground">Out</div>
                          <div className="font-medium text-minia-danger">{formatNumber(group.outQty)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-muted-foreground">Balance</div>
                          <div className="font-medium text-foreground">{formatNumber(group.closingQty)}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-5 py-3 font-medium text-muted-foreground">Date</th>
                          <th className="px-5 py-3 font-medium text-muted-foreground">Type</th>
                          <th className="px-5 py-3 font-medium text-muted-foreground">Batch</th>
                          <th className="px-5 py-3 font-medium text-muted-foreground">Warehouse</th>
                          <th className="px-5 py-3 text-right font-medium text-muted-foreground">In</th>
                          <th className="px-5 py-3 text-right font-medium text-muted-foreground">Out</th>
                          <th className="px-5 py-3 text-right font-medium text-muted-foreground">Balance</th>
                          <th className="px-5 py-3 text-right font-medium text-muted-foreground">Avg Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {group.rows.map((movement) => (
                          <tr key={movement.id}>
                            <td className="px-5 py-3 text-foreground">{formatDate(movement.transactionDate)}</td>
                            <td className="px-5 py-3 text-foreground">{formatMovementLabel(movement.movementType)}</td>
                            <td className="px-5 py-3 text-foreground">{movement.batchNumber || "-"}</td>
                            <td className="px-5 py-3 text-foreground">{movement.warehouseName || "-"}</td>
                            <td className="px-5 py-3 text-right text-minia-success">
                              {movement.direction === "IN" ? formatNumber(movement.quantity) : "-"}
                            </td>
                            <td className="px-5 py-3 text-right text-minia-danger">
                              {movement.direction === "OUT" ? formatNumber(movement.quantity) : "-"}
                            </td>
                            <td className="px-5 py-3 text-right font-medium text-foreground">{formatNumber(movement.runningQty)}</td>
                            <td className="px-5 py-3 text-right text-foreground">{formatNumber(movement.runningAverageCost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 ? (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href={buildPageHref({
                    itemId,
                    from,
                    to,
                    movementType,
                    sourceType,
                    page: Math.max(1, page - 1),
                  })}
                  className={`inline-flex items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium ${
                    page <= 1 ? "pointer-events-none opacity-50" : "hover:bg-accent"
                  }`}
                >
                  Previous
                </Link>
                <Link
                  href={buildPageHref({
                    itemId,
                    from,
                    to,
                    movementType,
                    sourceType,
                    page: Math.min(totalPages, page + 1),
                  })}
                  className={`inline-flex items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium ${
                    page >= totalPages ? "pointer-events-none opacity-50" : "hover:bg-accent"
                  }`}
                >
                  Next
                </Link>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
