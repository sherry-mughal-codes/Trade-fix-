"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOrganizationId, withOrganization } from "@/lib/tenant-db";
import { rebuildInventoryForItems } from "@/lib/inventory";
import { syncStockAdjustmentAccounting, syncStockEntryAccounting } from "@/lib/inventory-accounting";
import { ensureStandardPriceLists } from "@/lib/price-lists";
import { requireInventoryAccess } from "./access";

type InventoryLineInput = {
  itemId: string;
  batchNumber?: string | null;
  expiryDate?: string | null;
  warehouseName?: string | null;
  quantity: number;
  unitCost?: number;
};

function normalizeNumber(value: FormDataEntryValue | null) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeText(value: FormDataEntryValue | null) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function parseLines(raw: FormDataEntryValue | null) {
  try {
    const parsed = JSON.parse(String(raw || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function revalidateInventoryPaths() {
  revalidatePath("/inventory");
  revalidatePath("/inventory/stock-entry");
  revalidatePath("/inventory/stock-entry/new");
  revalidatePath("/inventory/adjustments");
  revalidatePath("/inventory/adjustments/new");
  revalidatePath("/inventory/batches");
  revalidatePath("/inventory/ledger");
  revalidatePath("/items");
  revalidatePath("/masters/price-lists");
  revalidatePath("/invoices");
  revalidatePath("/invoices/new");
}

function buildEntryNumber(prefix: string) {
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${suffix}`;
}

async function validateWarehouse(tx: any, organizationId: string, warehouseName?: string | null) {
  if (!warehouseName) return null;

  const savedWarehouse = await tx.inventoryWarehouse.findFirst({
    where: withOrganization(organizationId, {
      name: warehouseName,
      isActive: true,
    }),
  });

  if (!savedWarehouse) {
    throw new Error("Please select a valid warehouse");
  }

  return warehouseName;
}

async function validateBatch(tx: any, organizationId: string, batchNumber?: string | null) {
  if (!batchNumber) return null;

  const savedBatch = await tx.inventoryBatchMaster.findFirst({
    where: withOrganization(organizationId, {
      name: batchNumber,
      isActive: true,
    }),
  });

  if (!savedBatch) {
    throw new Error("Please select a valid batch");
  }

  return batchNumber;
}

async function validateInventoryItem(
  tx: any,
  organizationId: string,
  line: InventoryLineInput,
  options: {
    requireUnitCost: boolean;
    direction?: "IN" | "OUT";
  },
) {
  const item = await tx.item.findFirst({
    where: withOrganization(organizationId, { id: String(line.itemId || "") }),
  });

  if (!item) throw new Error("One of the selected items was not found");
  if (String(item.itemType || "INVENTORY").toUpperCase() !== "INVENTORY") {
    throw new Error(`Only inventory items can be used here. Problem item: ${item.name}`);
  }

  const quantity = Number(line.quantity || 0);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`Quantity must be greater than zero for ${item.name}`);
  }

  const batchNumber = await validateBatch(tx, organizationId, line.batchNumber ? String(line.batchNumber) : null);
  const warehouseName = await validateWarehouse(tx, organizationId, line.warehouseName ? String(line.warehouseName) : null);
  const expiryDate = line.expiryDate ? new Date(String(line.expiryDate)) : null;

  if (options.direction !== "OUT" && item.trackBatches && !batchNumber) {
    throw new Error(`Batch is required for ${item.name}`);
  }
  if (options.direction !== "OUT" && item.hasExpiry && !expiryDate) {
    throw new Error(`Expiry date is required for ${item.name}`);
  }

  const unitCost = options.requireUnitCost ? Number(line.unitCost || 0) : Number(line.unitCost || 0);

  if (options.requireUnitCost && (!Number.isFinite(unitCost) || unitCost < 0)) {
    throw new Error(`Unit cost is invalid for ${item.name}`);
  }

  return {
    item,
    itemId: item.id,
    batchNumber,
    warehouseName,
    expiryDate,
    quantity,
    unitCost: Number.isFinite(unitCost) ? unitCost : 0,
  };
}

export async function createStockEntry(formData: FormData) {
  try {
    await requireInventoryAccess("inventory.stockEntry.manage");
    const organizationId = await requireOrganizationId();

    const entryType = String(formData.get("entryType") || "OPENING");
    const transactionDate = String(formData.get("transactionDate") || "");
    const note = normalizeText(formData.get("note"));
    const rawLines = parseLines(formData.get("items"));

    if (!transactionDate) throw new Error("Transaction date is required");
    if (!rawLines.length) throw new Error("Please add at least one item");

    await prisma.$transaction(async (tx: any) => {
      const validatedLines = [];
      for (const rawLine of rawLines) {
        validatedLines.push(
          await validateInventoryItem(tx, organizationId, rawLine as InventoryLineInput, {
            requireUnitCost: true,
            direction: "IN",
          }),
        );
      }

      const entry = await tx.stockEntry.create({
        data: {
          organizationId,
          entryNumber: buildEntryNumber(entryType === "OPENING" ? "OSE" : "STE"),
          entryType,
          date: new Date(transactionDate),
          note,
          items: {
            create: validatedLines.map((line) => ({
              organizationId,
              itemId: line.itemId,
              batchNumber: line.batchNumber,
              expiryDate: line.expiryDate,
              warehouseName: line.warehouseName,
              quantity: line.quantity,
              unitCost: line.unitCost,
            })),
          },
        },
      });

      await tx.stockMovement.createMany({
        data: validatedLines.map((line) => ({
          organizationId,
          itemId: line.itemId,
          transactionDate: new Date(transactionDate),
          direction: "IN",
          movementType: entryType === "OPENING" ? "OPENING" : "MANUAL_RECEIPT",
          sourceType: "STOCK_ENTRY",
          sourceId: entry.id,
          sourceNumber: entry.entryNumber,
          note,
          quantity: line.quantity,
          unitCost: line.unitCost,
          totalCost: line.quantity * line.unitCost,
          runningQty: 0,
          runningAverageCost: 0,
          batchNumber: line.batchNumber,
          expiryDate: line.expiryDate,
          warehouseName: line.warehouseName,
        })),
      });

      await rebuildInventoryForItems(
        tx,
        organizationId,
        validatedLines.map((line) => line.itemId),
      );

      await syncStockEntryAccounting(tx, organizationId, entry.id);

      // Update Buying Price List with the entered unit cost for each item
      const standardLists = await ensureStandardPriceLists(organizationId);
      const activeBuyingLists = await tx.priceList.findMany({
        where: {
          organizationId,
          type: "BUYING",
          isActive: true,
        },
        select: { id: true },
      });

      const targetBuyingListIds = Array.from(
        new Set([
          standardLists.buying.id,
          ...activeBuyingLists.map((pl: any) => pl.id),
        ]),
      );

      for (const line of validatedLines) {
        if (line.unitCost && line.unitCost > 0) {
          for (const priceListId of targetBuyingListIds) {
            await tx.priceListItem.upsert({
              where: {
                priceListId_itemId: {
                  priceListId,
                  itemId: line.itemId,
                },
              },
              update: {
                price: line.unitCost,
              },
              create: {
                organizationId,
                priceListId,
                itemId: line.itemId,
                price: line.unitCost,
              },
            });
          }
        }
      }
    });

    revalidateInventoryPaths();
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to save stock entry" };
  }
}

export async function createStockAdjustment(formData: FormData) {
  try {
    await requireInventoryAccess("inventory.adjustments.manage");
    const organizationId = await requireOrganizationId();

    const adjustmentType = String(formData.get("adjustmentType") || "OUT");
    const transactionDate = String(formData.get("transactionDate") || "");
    const note = normalizeText(formData.get("note"));
    const rawLines = parseLines(formData.get("items"));

    if (!transactionDate) throw new Error("Transaction date is required");
    if (!rawLines.length) throw new Error("Please add at least one item");

    await prisma.$transaction(async (tx: any) => {
      const direction = adjustmentType === "IN" ? "IN" : "OUT";
      const validatedLines = [];

      for (const rawLine of rawLines) {
        validatedLines.push(
          await validateInventoryItem(tx, organizationId, rawLine as InventoryLineInput, {
            requireUnitCost: true,
            direction,
          }),
        );
      }

      const adjustment = await tx.stockAdjustment.create({
        data: {
          organizationId,
          adjustmentNumber: buildEntryNumber(direction === "IN" ? "SAI" : "SAO"),
          adjustmentType: direction,
          date: new Date(transactionDate),
          note,
          items: {
            create: validatedLines.map((line) => ({
              organizationId,
              itemId: line.itemId,
              direction,
              batchNumber: direction === "IN" ? line.batchNumber : null,
              expiryDate: direction === "IN" ? line.expiryDate : null,
              warehouseName: line.warehouseName,
              quantity: line.quantity,
              unitCost: line.unitCost,
            })),
          },
        },
      });

      await tx.stockMovement.createMany({
        data: validatedLines.map((line) => ({
          organizationId,
          itemId: line.itemId,
          transactionDate: new Date(transactionDate),
          direction,
          movementType: direction === "IN" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
          sourceType: "STOCK_ADJUSTMENT",
          sourceId: adjustment.id,
          sourceNumber: adjustment.adjustmentNumber,
          note,
          quantity: line.quantity,
          unitCost: line.unitCost,
          totalCost: line.quantity * line.unitCost,
          runningQty: 0,
          runningAverageCost: 0,
          batchNumber: direction === "IN" ? line.batchNumber : null,
          expiryDate: direction === "IN" ? line.expiryDate : null,
          warehouseName: line.warehouseName,
        })),
      });

      await rebuildInventoryForItems(
        tx,
        organizationId,
        validatedLines.map((line) => line.itemId),
      );

      await syncStockAdjustmentAccounting(tx, organizationId, adjustment.id);
    });

    revalidateInventoryPaths();
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to save stock adjustment" };
  }
}
