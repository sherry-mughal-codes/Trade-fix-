import { prisma } from "@/lib/prisma";

export const STANDARD_SELLING_PRICE_LIST_NAME = "Standard Selling Price List";
export const STANDARD_BUYING_PRICE_LIST_NAME = "Standard Buying Price List";

export type PriceListType = "SELLING" | "BUYING";

export async function ensureStandardPriceLists(organizationId: string) {
  const { selling, buying } = await prisma.$transaction(async (tx) => {
    const selling = await tx.priceList.upsert({
      where: {
        organizationId_name: {
          organizationId,
          name: STANDARD_SELLING_PRICE_LIST_NAME,
        },
      },
      update: {
        isSystemDefault: true,
        type: "SELLING",
      },
      create: {
        organizationId,
        name: STANDARD_SELLING_PRICE_LIST_NAME,
        type: "SELLING",
        isActive: true,
        isSystemDefault: true,
      },
      select: { id: true, type: true, name: true, isActive: true },
    });

    const buying = await tx.priceList.upsert({
      where: {
        organizationId_name: {
          organizationId,
          name: STANDARD_BUYING_PRICE_LIST_NAME,
        },
      },
      update: {
        isSystemDefault: true,
        type: "BUYING",
      },
      create: {
        organizationId,
        name: STANDARD_BUYING_PRICE_LIST_NAME,
        type: "BUYING",
        isActive: true,
        isSystemDefault: true,
      },
      select: { id: true, type: true, name: true, isActive: true },
    });

    return { selling, buying };
  });

  if (!selling || !buying) {
    throw new Error("Failed to ensure standard price lists.");
  }

  return { selling, buying };
}
