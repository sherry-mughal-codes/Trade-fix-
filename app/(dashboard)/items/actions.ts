"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOrganizationId, requireOwnedRecord, withOrganization } from "@/lib/tenant-db";
import { parseItemUnitConversions, normalizeItemType } from "@/lib/item-master";
import { hasItemMasterAccess } from "./access";

function normalizeBoolean(value: FormDataEntryValue | null, fallback = false) {
  if (value === null) return fallback;
  return String(value) === "true";
}

async function saveItem(formData: FormData, existingId?: string) {
  if (!(await hasItemMasterAccess())) {
    return { error: "Not allowed" };
  }

  const organizationId = await requireOrganizationId();
  const itemCode = String(formData.get("itemCode") || "").trim() || null;
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
    unitConversions = parseItemUnitConversions(String(formData.get("unitsData") || ""), defaultUnit);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unit conversions are invalid." };
  }

  const duplicateWhere = existingId
    ? { id: { not: existingId } }
    : {};

  const existingName = await prisma.item.findFirst({
    where: withOrganization(organizationId, {
      name,
      ...duplicateWhere,
    }),
  });

  if (existingName) return { error: "Item name must be unique" };

  if (itemCode) {
    const existingCode = await prisma.item.findFirst({
      where: withOrganization(organizationId, {
        itemCode,
        ...duplicateWhere,
      }),
    });

    if (existingCode) return { error: "Item code must be unique" };
  }

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
      await prisma.$transaction(async (tx) => {
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
            })),
          });
        }
      });
    } else {
      await prisma.$transaction(async (tx) => {
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
            })),
          });
        }
      });
    }
  } catch (error) {
    console.error("Failed to save item", error);
    return { error: "Failed to save item" };
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
