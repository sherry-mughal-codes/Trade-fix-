"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOrganizationId, requireOwnedRecord, withOrganization } from "@/lib/tenant-db";
import { requireItemMasterAccess } from "../../items/access";

type PriceListType = "SELLING" | "BUYING";

export type PriceListItemInput = {
  itemId: string;
  unitName: string;
  price: number;
};

function normalizeType(value: FormDataEntryValue | null): PriceListType {
  return String(value || "").toUpperCase() === "BUYING" ? "BUYING" : "SELLING";
}

function normalizeBoolean(value: FormDataEntryValue | null, fallback = false) {
  if (value === null) return fallback;
  return String(value) === "true";
}

function parseItemsData(value: FormDataEntryValue | null): PriceListItemInput[] {
  const raw = String(value || "");
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Price list items are invalid.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Price list items are invalid.");
  }

  const rows = parsed
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const itemId = String((row as any).itemId || "").trim();
      const unitName = String((row as any).unitName || "").trim();
      const price = Number((row as any).price || 0);
      if (!itemId) return null;
      if (!unitName) {
        throw new Error("Each price list item must have a unit specified.");
      }
      if (!Number.isFinite(price) || price < 0) {
        throw new Error("Price must be a non-negative number.");
      }
      return { itemId, unitName, price };
    })
    .filter(Boolean) as PriceListItemInput[];

  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.itemId}:${row.unitName.toUpperCase()}`;
    if (seen.has(key)) {
      throw new Error(`Duplicate price for item and unit '${row.unitName}' is not allowed in the same price list.`);
    }
    seen.add(key);
  }

  return rows;
}

async function savePriceList(formData: FormData, existingId?: string) {
  await requireItemMasterAccess();
  const organizationId = await requireOrganizationId();

  const submittedName = String(formData.get("name") || "").trim();
  const type = normalizeType(formData.get("type"));
  const isActive = normalizeBoolean(formData.get("isActive"), true);

  let items: PriceListItemInput[] = [];
  try {
    items = parseItemsData(formData.get("itemsData"));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Price list items are invalid." };
  }

  let existingMeta: { isSystemDefault: boolean; type: string; name: string } | null = null;

  if (existingId) {
    await requireOwnedRecord(prisma.priceList as any, existingId, organizationId);
    existingMeta = await prisma.priceList.findFirst({
      where: withOrganization(organizationId, { id: existingId }),
      select: { isSystemDefault: true, type: true, name: true },
    });

    if (!existingMeta) {
      return { error: "Price list not found." };
    }
  }

  const name = existingMeta?.isSystemDefault ? existingMeta.name : submittedName;

  if (!name) {
    return { error: "Price list name is required." };
  }

  const duplicate = await prisma.priceList.findFirst({
    where: withOrganization(organizationId, {
      name,
      ...(existingId ? { id: { not: existingId } } : {}),
    }),
    select: { id: true },
  });

  if (duplicate) {
    return { error: "Price list name must be unique." };
  }

  const itemIds = Array.from(new Set(items.map((row) => row.itemId)));
  if (itemIds.length) {
    const foundItems = await prisma.item.findMany({
      where: withOrganization(organizationId, {
        id: { in: itemIds },
      }),
      include: {
        unitConversions: {
          select: { unitName: true },
        },
      },
    });

    if (foundItems.length !== itemIds.length) {
      return { error: "One or more items selected for the price list are invalid or do not belong to this organization." };
    }

    const itemMap = new Map(foundItems.map((item) => [item.id, item]));
    for (const row of items) {
      const item = itemMap.get(row.itemId);
      if (!item) {
        return { error: "Invalid item selected." };
      }
      const validUnits = new Set([
        item.defaultUnit.toUpperCase(),
        ...item.unitConversions.map((u) => u.unitName.toUpperCase()),
      ]);
      if (!validUnits.has(row.unitName.toUpperCase())) {
        return {
          error: `Unit '${row.unitName}' is not valid for item '${item.name}'. Valid units are: ${[item.defaultUnit, ...item.unitConversions.map((u) => u.unitName)].join(", ")}.`,
        };
      }
    }
  }

  try {
    if (existingId) {
      if (!existingMeta) {
        return { error: "Price list not found." };
      }

      await prisma.$transaction(async (tx) => {
        await tx.priceList.update({
          where: { id: existingId },
          data: {
            name: existingMeta.isSystemDefault ? existingMeta.name : name,
            type: existingMeta.isSystemDefault ? existingMeta.type : type,
            isActive,
          },
        });

        await tx.priceListItem.deleteMany({
          where: {
            organizationId,
            priceListId: existingId,
          },
        });

        if (items.length) {
          await tx.priceListItem.createMany({
            data: items.map((row) => ({
              organizationId,
              priceListId: existingId,
              itemId: row.itemId,
              unitName: row.unitName,
              price: row.price,
            })),
          });
        }
      });
    } else {
      await prisma.$transaction(async (tx) => {
        const priceList = await tx.priceList.create({
          data: {
            organizationId,
            name,
            type,
            isActive,
            isSystemDefault: false,
          },
          select: { id: true },
        });

        if (items.length) {
          await tx.priceListItem.createMany({
            data: items.map((row) => ({
              organizationId,
              priceListId: priceList.id,
              itemId: row.itemId,
              unitName: row.unitName,
              price: row.price,
            })),
          });
        }
      });
    }
  } catch (error) {
    console.error("Failed to save price list", error);
    return { error: "Failed to save price list." };
  }

  revalidatePath("/masters");
  revalidatePath("/masters/price-lists");
  revalidatePath("/customers");
  revalidatePath("/suppliers");
  revalidatePath("/invoices/new");

  return { success: true, redirectUrl: "/masters/price-lists" };
}

export async function createPriceList(formData: FormData) {
  return savePriceList(formData);
}

export async function updatePriceList(id: string, formData: FormData) {
  return savePriceList(formData, id);
}

export async function deletePriceList(id: string) {
  await requireItemMasterAccess();
  const organizationId = await requireOrganizationId();

  const priceList = await prisma.priceList.findFirst({
    where: withOrganization(organizationId, { id }),
    select: { id: true, isSystemDefault: true },
  });

  if (!priceList) {
    throw new Error("Price list not found.");
  }

  if (priceList.isSystemDefault) {
    throw new Error("Standard price lists cannot be deleted.");
  }

  const linked = await prisma.party.count({
    where: withOrganization(organizationId, {
      OR: [{ sellingPriceListId: id }, { buyingPriceListId: id }],
    }),
  });

  if (linked) {
    throw new Error("Cannot delete a price list that is assigned to a customer or supplier.");
  }

  await prisma.priceList.delete({ where: { id } });
  revalidatePath("/masters/price-lists");
  revalidatePath("/customers");
  revalidatePath("/suppliers");
  revalidatePath("/invoices/new");
}

export async function getPriceListPrices(priceListId: string) {
  await requireItemMasterAccess();
  const organizationId = await requireOrganizationId();

  const priceList = await prisma.priceList.findFirst({
    where: withOrganization(organizationId, { id: priceListId, isActive: true }),
    select: { id: true },
  });

  if (!priceList) {
    throw new Error("Price list not found.");
  }

  const items = await prisma.priceListItem.findMany({
    where: withOrganization(organizationId, { priceListId }),
    select: { itemId: true, unitName: true, price: true },
  });

  return items.reduce<Record<string, number>>((acc, row) => {
    const p = Number(row.price || 0);
    acc[row.itemId] = p;
    acc[`${row.itemId}:${row.unitName}`] = p;
    return acc;
  }, {});
}
