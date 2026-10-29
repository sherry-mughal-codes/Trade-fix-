"use server";

import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/rbac";
import { requireOrganizationId, withOrganization } from "@/lib/tenant-db";

export async function getInvoicePriceListPrices(priceListId: string) {
  await requirePageAccess("invoices.create", "/invoices");
  const organizationId = await requireOrganizationId();

  const priceList = await prisma.priceList.findFirst({
    where: withOrganization(organizationId, { id: priceListId, isActive: true }),
    select: { id: true },
  });

  if (!priceList) {
    throw new Error("Price list not found.");
  }

  const rows = await prisma.priceListItem.findMany({
    where: withOrganization(organizationId, { priceListId }),
    select: { itemId: true, unitName: true, price: true },
  });

  return rows.reduce<Record<string, number>>((acc, row) => {
    const p = Number(row.price || 0);
    acc[row.itemId] = p;
    acc[`${row.itemId}:${row.unitName}`] = p;
    return acc;
  }, {});
}

