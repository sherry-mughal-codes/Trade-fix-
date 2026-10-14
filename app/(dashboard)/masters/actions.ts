"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOrganizationId, requireOwnedRecord, withOrganization } from "@/lib/tenant-db";
import { requireItemMasterAccess } from "../items/access";

type MasterType = "unit" | "category" | "batch" | "warehouse";

function getLabel(type: MasterType) {
  if (type === "unit") return "Unit";
  if (type === "category") return "Category";
  if (type === "batch") return "Batch";
  return "Warehouse";
}

function getListPath(type: MasterType) {
  if (type === "unit") return "/masters/units";
  if (type === "category") return "/masters/categories";
  if (type === "batch") return "/masters/batches";
  return "/masters/warehouses";
}

async function saveMasterRecord(type: MasterType, formData: FormData, existingId?: string) {
  await requireItemMasterAccess();
  const organizationId = await requireOrganizationId();
  const label = getLabel(type);
  const listPath = getListPath(type);

  const name = String(formData.get("name") || "").trim();
  const isActive = String(formData.get("isActive") || "true") !== "false";

  if (!name) return { error: `${label} name is required` };

  let duplicate = null;

  if (type === "unit") {
    duplicate = await prisma.itemUnit.findFirst({
      where: withOrganization(organizationId, {
        name,
        ...(existingId ? { id: { not: existingId } } : {}),
      }),
    });
  } else if (type === "category") {
    duplicate = await prisma.itemCategory.findFirst({
      where: withOrganization(organizationId, {
        name,
        ...(existingId ? { id: { not: existingId } } : {}),
      }),
    });
  } else if (type === "batch") {
    duplicate = await prisma.inventoryBatchMaster.findFirst({
      where: withOrganization(organizationId, {
        name,
        ...(existingId ? { id: { not: existingId } } : {}),
      }),
    });
  } else {
    duplicate = await prisma.inventoryWarehouse.findFirst({
      where: withOrganization(organizationId, {
        name,
        ...(existingId ? { id: { not: existingId } } : {}),
      }),
    });
  }

  if (duplicate) return { error: `${label} name must be unique` };

  if (existingId) {
    if (type === "unit") {
      await requireOwnedRecord(prisma.itemUnit as any, existingId, organizationId);
      await prisma.itemUnit.update({
        where: { id: existingId },
        data: { name, isActive },
      });
    } else if (type === "category") {
      await requireOwnedRecord(prisma.itemCategory as any, existingId, organizationId);
      await prisma.itemCategory.update({
        where: { id: existingId },
        data: { name, isActive },
      });
    } else if (type === "batch") {
      await requireOwnedRecord(prisma.inventoryBatchMaster as any, existingId, organizationId);
      await prisma.inventoryBatchMaster.update({
        where: { id: existingId },
        data: { name, isActive },
      });
    } else {
      await requireOwnedRecord(prisma.inventoryWarehouse as any, existingId, organizationId);
      await prisma.inventoryWarehouse.update({
        where: { id: existingId },
        data: { name, isActive },
      });
    }
  } else {
    if (type === "unit") {
      await prisma.itemUnit.create({
        data: {
          organizationId,
          name,
          isActive,
        },
      });
    } else if (type === "category") {
      await prisma.itemCategory.create({
        data: {
          organizationId,
          name,
          isActive,
        },
      });
    } else if (type === "batch") {
      await prisma.inventoryBatchMaster.create({
        data: {
          organizationId,
          name,
          isActive,
        },
      });
    } else {
      await prisma.inventoryWarehouse.create({
        data: {
          organizationId,
          name,
          isActive,
        },
      });
    }
  }

  revalidatePath("/masters");
  revalidatePath("/items");
  revalidatePath("/inventory");
  revalidatePath("/inventory/stock-entry");
  revalidatePath("/inventory/stock-entry/new");
  revalidatePath("/inventory/adjustments");
  revalidatePath("/inventory/adjustments/new");
  revalidatePath("/invoices/new");
  revalidatePath(listPath);
  return { success: true, redirectUrl: listPath };
}

async function deleteMasterRecord(type: MasterType, id: string) {
  await requireItemMasterAccess();
  const organizationId = await requireOrganizationId();
  const listPath = getListPath(type);

  if (type === "unit") {
    await requireOwnedRecord(prisma.itemUnit as any, id, organizationId);
    await prisma.itemUnit.delete({ where: { id } });
  } else if (type === "category") {
    await requireOwnedRecord(prisma.itemCategory as any, id, organizationId);
    await prisma.itemCategory.delete({ where: { id } });
  } else if (type === "batch") {
    await requireOwnedRecord(prisma.inventoryBatchMaster as any, id, organizationId);
    await prisma.inventoryBatchMaster.delete({ where: { id } });
  } else {
    await requireOwnedRecord(prisma.inventoryWarehouse as any, id, organizationId);
    await prisma.inventoryWarehouse.delete({ where: { id } });
  }

  revalidatePath("/masters");
  revalidatePath("/items");
  revalidatePath("/inventory");
  revalidatePath("/inventory/stock-entry");
  revalidatePath("/inventory/stock-entry/new");
  revalidatePath("/inventory/adjustments");
  revalidatePath("/inventory/adjustments/new");
  revalidatePath("/invoices/new");
  revalidatePath(listPath);
}

export async function createItemUnit(formData: FormData) {
  return saveMasterRecord("unit", formData);
}

export async function updateItemUnit(id: string, formData: FormData) {
  return saveMasterRecord("unit", formData, id);
}

export async function deleteItemUnit(id: string) {
  return deleteMasterRecord("unit", id);
}

export async function createItemCategory(formData: FormData) {
  return saveMasterRecord("category", formData);
}

export async function updateItemCategory(id: string, formData: FormData) {
  return saveMasterRecord("category", formData, id);
}

export async function deleteItemCategory(id: string) {
  return deleteMasterRecord("category", id);
}

export async function createInventoryBatchMaster(formData: FormData) {
  return saveMasterRecord("batch", formData);
}

export async function updateInventoryBatchMaster(id: string, formData: FormData) {
  return saveMasterRecord("batch", formData, id);
}

export async function deleteInventoryBatchMaster(id: string) {
  return deleteMasterRecord("batch", id);
}

export async function createInventoryWarehouse(formData: FormData) {
  return saveMasterRecord("warehouse", formData);
}

export async function updateInventoryWarehouse(id: string, formData: FormData) {
  return saveMasterRecord("warehouse", formData, id);
}

export async function deleteInventoryWarehouse(id: string) {
  return deleteMasterRecord("warehouse", id);
}
