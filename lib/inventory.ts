export const INVENTORY_POSTING_STATUSES = ["SENT", "PAID", "PARTIALLY_PAID", "OVERDUE"];

const EPSILON = 0.000001;

type InventoryTx = any;

function isInventoryItem(item: any) {
  return String(item?.itemType || "INVENTORY").toUpperCase() === "INVENTORY";
}

function normalizeNumber(value: any) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortFefoBatches<T extends { expiryDate?: Date | string | null; receivedDate?: Date | string | null; createdAt?: Date | string | null }>(batches: T[]) {
  return [...batches].sort((a, b) => {
    const aExpiry = a.expiryDate ? new Date(a.expiryDate).getTime() : Number.POSITIVE_INFINITY;
    const bExpiry = b.expiryDate ? new Date(b.expiryDate).getTime() : Number.POSITIVE_INFINITY;
    if (aExpiry !== bExpiry) return aExpiry - bExpiry;

    const aReceived = a.receivedDate ? new Date(a.receivedDate).getTime() : Number.POSITIVE_INFINITY;
    const bReceived = b.receivedDate ? new Date(b.receivedDate).getTime() : Number.POSITIVE_INFINITY;
    if (aReceived !== bReceived) return aReceived - bReceived;

    const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : Number.POSITIVE_INFINITY;
    const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : Number.POSITIVE_INFINITY;
    return aCreated - bCreated;
  });
}

export function shouldPostInventory(status?: string | null) {
  return INVENTORY_POSTING_STATUSES.includes(String(status || "").toUpperCase());
}

export async function rebuildItemInventory(tx: InventoryTx, organizationId: string, itemId: string) {
  const settings = await tx.companySettings.findFirst({
    where: { organizationId },
    select: { allowNegativeStock: true },
  });
  const allowNegativeStock = Boolean(settings?.allowNegativeStock);

  const movements = await tx.stockMovement.findMany({
    where: {
      organizationId,
      itemId,
    },
    orderBy: [
      { transactionDate: "asc" },
      { createdAt: "asc" },
      { id: "asc" },
    ],
  });

  let stockOnHand = 0;
  let movingAverageCost = 0;
  const batches: any[] = [];
  let negativeCarryQty = 0;

  for (const movement of movements) {
    const quantity = normalizeNumber(movement.quantity);
    if (quantity <= 0) continue;

    if (movement.direction === "IN") {
      const unitCost = normalizeNumber(movement.unitCost);
      const totalCost = quantity * unitCost;
      const nextQty = stockOnHand + quantity;
      const qtyToRelease = Math.max(0, quantity - negativeCarryQty);
      const currentValue = stockOnHand > EPSILON ? stockOnHand * movingAverageCost : 0;

      movingAverageCost =
        stockOnHand > EPSILON && nextQty > EPSILON ? (currentValue + totalCost) / nextQty : unitCost;
      stockOnHand = nextQty;
      negativeCarryQty = Math.max(0, negativeCarryQty - quantity);

      if (qtyToRelease > EPSILON) {
        batches.push({
          organizationId,
          itemId,
          sourceType: movement.sourceType,
          sourceId: movement.sourceId || movement.id,
          sourceNumber: movement.sourceNumber || null,
          batchNumber: movement.batchNumber || null,
          expiryDate: movement.expiryDate || null,
          warehouseName: movement.warehouseName || null,
          receivedDate: movement.transactionDate,
          originalQty: qtyToRelease,
          availableQty: qtyToRelease,
          unitCost,
          isActive: true,
          createdAt: movement.createdAt,
        });
      }

      await tx.stockMovement.update({
        where: { id: movement.id },
        data: {
          unitCost,
          totalCost,
          runningQty: stockOnHand,
          runningAverageCost: movingAverageCost,
        },
      });

      continue;
    }

    let remaining = quantity;
    const availableBatches = sortFefoBatches(
      batches.filter((batch) => normalizeNumber(batch.availableQty) > EPSILON),
    );

    for (const batch of availableBatches) {
      if (remaining <= EPSILON) break;
      const availableQty = normalizeNumber(batch.availableQty);
      if (availableQty <= EPSILON) continue;

      const consumedQty = Math.min(availableQty, remaining);
      batch.availableQty = availableQty - consumedQty;
      remaining -= consumedQty;
    }

    if (remaining > EPSILON) {
      if (!allowNegativeStock) {
        throw new Error("Insufficient stock for the selected item.");
      }
      negativeCarryQty += remaining;
    }

    stockOnHand -= quantity;
    await tx.stockMovement.update({
      where: { id: movement.id },
      data: {
        unitCost: movingAverageCost,
        totalCost: quantity * movingAverageCost,
        runningQty: stockOnHand,
        runningAverageCost: movingAverageCost,
      },
    });
  }

  await tx.itemBatch.deleteMany({
    where: {
      organizationId,
      itemId,
    },
  });

  const liveBatches = batches
    .filter((batch) => normalizeNumber(batch.originalQty) > EPSILON)
    .map((batch) => ({
      organizationId: batch.organizationId,
      itemId: batch.itemId,
      sourceType: batch.sourceType,
      sourceId: batch.sourceId,
      sourceNumber: batch.sourceNumber,
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate,
      warehouseName: batch.warehouseName,
      receivedDate: batch.receivedDate,
      originalQty: normalizeNumber(batch.originalQty),
      availableQty: normalizeNumber(batch.availableQty),
      unitCost: normalizeNumber(batch.unitCost),
      isActive: normalizeNumber(batch.availableQty) > EPSILON,
    }));

  if (liveBatches.length) {
    await tx.itemBatch.createMany({
      data: liveBatches,
    });
  }

  await tx.item.update({
    where: { id: itemId },
    data: {
      stockOnHand,
      movingAverageCost,
    },
  });
}

export async function rebuildInventoryForItems(tx: InventoryTx, organizationId: string, itemIds: string[]) {
  const uniqueItemIds = Array.from(new Set(itemIds.filter(Boolean)));
  for (const itemId of uniqueItemIds) {
    await rebuildItemInventory(tx, organizationId, itemId);
  }
}

export async function clearInventoryForSource(tx: InventoryTx, organizationId: string, sourceType: string, sourceId: string) {
  const existing = await tx.stockMovement.findMany({
    where: {
      organizationId,
      sourceType,
      sourceId,
    },
    select: {
      itemId: true,
    },
  });

  await tx.stockMovement.deleteMany({
    where: {
      organizationId,
      sourceType,
      sourceId,
    },
  });

  return Array.from(new Set(existing.map((row: any) => String(row.itemId)).filter(Boolean))) as string[];
}

export async function syncInvoiceInventory(tx: InventoryTx, organizationId: string, invoiceId: string) {
  const invoice = await tx.invoice.findFirst({
    where: {
      id: invoiceId,
      organizationId,
    },
    include: {
      items: {
        include: {
          item: true,
        },
      },
    },
  });

  if (!invoice) {
    throw new Error("Invoice not found");
  }

  const affectedFromDelete = await clearInventoryForSource(tx, organizationId, "INVOICE", invoice.id);
  const inventoryItems = invoice.items.filter((row: any) => row.item && isInventoryItem(row.item));

  if (!shouldPostInventory(invoice.status) || inventoryItems.length === 0) {
    if (affectedFromDelete.length) {
      await rebuildInventoryForItems(tx, organizationId, affectedFromDelete);
    }
    return;
  }

  const movementsToCreate = inventoryItems.map((row: any) => {
    const quantity = normalizeNumber(row.quantity);
    if (quantity <= 0) {
      throw new Error(`Quantity must be greater than zero for ${row.description}.`);
    }

    if (invoice.type === "PURCHASE") {
      if (row.item.trackBatches && !String(row.batchNumber || "").trim()) {
        throw new Error(`Batch number is required for ${row.description}.`);
      }
      if (row.item.hasExpiry && !row.expiryDate) {
        throw new Error(`Expiry date is required for ${row.description}.`);
      }
    }

    return {
      organizationId,
      itemId: row.itemId,
      invoiceId: invoice.id,
      transactionDate: invoice.date,
      direction: invoice.type === "PURCHASE" ? "IN" : "OUT",
      movementType: invoice.type === "PURCHASE" ? "PURCHASE_RECEIPT" : "SALE_ISSUE",
      sourceType: "INVOICE",
      sourceId: invoice.id,
      sourceNumber: invoice.invoiceNumber,
      note: `${invoice.type === "PURCHASE" ? "Purchase" : "Sale"} invoice ${invoice.invoiceNumber}`,
      quantity,
      unitCost: invoice.type === "PURCHASE" ? normalizeNumber(row.amount) / quantity : 0,
      totalCost: 0,
      runningQty: 0,
      runningAverageCost: 0,
      batchNumber: invoice.type === "PURCHASE" ? String(row.batchNumber || "").trim() || null : null,
      expiryDate: invoice.type === "PURCHASE" ? row.expiryDate || null : null,
      warehouseName: String(row.warehouseName || "").trim() || null,
    };
  });

  if (movementsToCreate.length) {
    await tx.stockMovement.createMany({
      data: movementsToCreate,
    });
  }

  await rebuildInventoryForItems(
    tx,
    organizationId,
    Array.from(new Set([...affectedFromDelete, ...movementsToCreate.map((row: any) => row.itemId)])),
  );
}
