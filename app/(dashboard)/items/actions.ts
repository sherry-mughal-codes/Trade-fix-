"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOrganizationId, requireOwnedRecord, withOrganization } from "@/lib/tenant-db";
import { parseItemUnitConversions, normalizeItemType, normalizeBarcode } from "@/lib/item-master";
import { hasItemMasterAccess } from "./access";

function normalizeBoolean(value: FormDataEntryValue | null, fallback = false) {
  if (value === null) return fallback;
  return String(value) === "true";
}

export async function checkBarcodeAvailability(barcode: string, currentItemId?: string) {
  if (!(await hasItemMasterAccess())) {
    return { available: false, message: "Not allowed" };
  }

  const organizationId = await requireOrganizationId();
  const normalized = normalizeBarcode(barcode);
  if (!normalized) {
    return { available: true };
  }

  const itemDuplicateWhere = currentItemId ? { id: { not: currentItemId } } : {};
  const conversionDuplicateWhere = currentItemId ? { itemId: { not: currentItemId } } : {};

  // Check Item.itemCode
  const existingItem = await prisma.item.findFirst({
    where: withOrganization(organizationId, {
      itemCode: normalized,
      ...itemDuplicateWhere,
    }),
    select: { id: true, name: true },
  });

  if (existingItem) {
    return {
      available: false,
      message: `Barcode is already in use as Item Code for "${existingItem.name}".`,
    };
  }

  // Check ItemUnitConversion.barcode
  const existingConversion = await prisma.itemUnitConversion.findFirst({
    where: withOrganization(organizationId, {
      barcode: normalized,
      ...conversionDuplicateWhere,
    }),
    select: { id: true, unitName: true, item: { select: { name: true } } },
  });

  if (existingConversion) {
    return {
      available: false,
      message: `Barcode is already in use by unit "${existingConversion.unitName}" of item "${existingConversion.item?.name || 'unknown'}".`,
    };
  }

  return { available: true };
}

async function saveItem(formData: FormData, existingId?: string) {
  if (!(await hasItemMasterAccess())) {
    return { error: "Not allowed" };
  }

  const organizationId = await requireOrganizationId();
  const rawItemCode = String(formData.get("itemCode") || "").trim();
  const itemCode = rawItemCode ? normalizeBarcode(rawItemCode) : null;
  const name = String(formData.get("name") || "").trim();
  const category = String(formData.get("category") || "").trim() || null;
  const description = String(formData.get("description") || "").trim() || null;
  const defaultUnit = String(formData.get("defaultUnit") || "").trim();
  const itemType = normalizeItemType(String(formData.get("itemType") || "INVENTORY"));
  const isActive = normalizeBoolean(formData.get("isActive"), true);
  const trackBatches = itemType === "INVENTORY" ? normalizeBoolean(formData.get("trackBatches"), true) : false;
  const hasExpiry = itemType === "INVENTORY" ? normalizeBoolean(formData.get("hasExpiry"), true) : false;

  if (!name) return { error: "Item name is required" };
  if (!defaultUnit) return { error: "Default unit is required" };

  let unitConversions;
  try {
    unitConversions = parseItemUnitConversions(
      String(formData.get("unitsData") || ""),
      defaultUnit,
      itemCode,
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unit conversions are invalid." };
  }

  const duplicateWhere = existingId ? { id: { not: existingId } } : {};
  const convDuplicateWhere = existingId ? { itemId: { not: existingId } } : {};

  const itemData = {
    organizationId,
    itemCode,
    name,
    category,
    description,
    defaultUnit,
    itemType,
    isActive,
    trackBatches,
    hasExpiry,
  };

  try {
    if (existingId) {
      await requireOwnedRecord(prisma.item, existingId, organizationId);
    }

    const result = await prisma.$transaction(async (tx) => {
      // Transaction advisory lock to ensure serialization within the organization
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;

      // 1. Unique item name check
      const existingName = await tx.item.findFirst({
        where: withOrganization(organizationId, {
          name,
          ...duplicateWhere,
        }),
      });
      if (existingName) {
        throw new Error("Item name must be unique");
      }

      // 2. Unique Item Code check
      if (itemCode) {
        const existingCode = await tx.item.findFirst({
          where: withOrganization(organizationId, {
            itemCode,
            ...duplicateWhere,
          }),
        });
        if (existingCode) {
          throw new Error("Item code must be unique");
        }

        const existingBarcodeOnConv = await tx.itemUnitConversion.findFirst({
          where: withOrganization(organizationId, {
            barcode: itemCode,
            ...convDuplicateWhere,
          }),
        });
        if (existingBarcodeOnConv) {
          throw new Error("Item code is already in use as an alternate unit barcode");
        }
      }

      // 3. Alternate unit barcodes check against DB
      for (const conv of unitConversions) {
        // Must not conflict with any Item.itemCode
        const existingItemWithBarcode = await tx.item.findFirst({
          where: withOrganization(organizationId, {
            itemCode: conv.barcode,
            ...duplicateWhere,
          }),
        });
        if (existingItemWithBarcode) {
          throw new Error(`Alternate unit barcode '${conv.barcode}' is already in use as Item Code for '${existingItemWithBarcode.name}'`);
        }

        // Must not conflict with any other ItemUnitConversion.barcode
        const existingConvWithBarcode = await tx.itemUnitConversion.findFirst({
          where: withOrganization(organizationId, {
            barcode: conv.barcode,
            ...convDuplicateWhere,
          }),
        });
        if (existingConvWithBarcode) {
          throw new Error(`Alternate unit barcode '${conv.barcode}' is already in use by another alternate unit`);
        }
      }

      // 4. Persistence
      if (existingId) {
        await tx.item.update({
          where: { id: existingId },
          data: itemData,
        });

        await tx.itemUnitConversion.deleteMany({
          where: {
            organizationId,
            itemId: existingId,
          },
        });

        if (unitConversions.length) {
          await tx.itemUnitConversion.createMany({
            data: unitConversions.map((unit) => ({
              organizationId,
              itemId: existingId,
              unitName: unit.unitName,
              conversionFactor: unit.conversionFactor,
              barcode: unit.barcode,
            })),
          });
        }
      } else {
        const item = await tx.item.create({
          data: itemData,
          select: { id: true },
        });

        if (unitConversions.length) {
          await tx.itemUnitConversion.createMany({
            data: unitConversions.map((unit) => ({
              organizationId,
              itemId: item.id,
              unitName: unit.unitName,
              conversionFactor: unit.conversionFactor,
              barcode: unit.barcode,
            })),
          });
        }
      }

      return { success: true };
    });

    if (result && "error" in result) {
      return result;
    }
  } catch (error: any) {
    if (error?.code === "P2002") {
      return { error: "A duplicate barcode or code already exists in this organization." };
    }
    console.error("Failed to save item", error);
    return { error: error instanceof Error ? error.message : "Failed to save item" };
  }

  revalidatePath("/items");
  revalidatePath("/masters");
  revalidatePath("/invoices/new");

  return { success: true };
}

export async function createItem(formData: FormData) {
  return saveItem(formData);
}

export async function updateItem(id: string, formData: FormData) {
  return saveItem(formData, id);
}

export async function deleteItem(id: string) {
  if (!(await hasItemMasterAccess())) {
    throw new Error("Not allowed");
  }

  const organizationId = await requireOrganizationId();
  const item = await prisma.item.findFirst({
    where: withOrganization(organizationId, { id }),
    include: {
      invoiceItems: {
        select: { id: true },
        take: 1,
      },
      unitConversions: {
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!item) throw new Error("Item not found");
  if (item.invoiceItems.length) {
    throw new Error("Cannot delete item with linked invoice usage.");
  }

  await prisma.item.delete({ where: { id } });
  revalidatePath("/items");
  revalidatePath("/masters");
  revalidatePath("/invoices/new");
}
