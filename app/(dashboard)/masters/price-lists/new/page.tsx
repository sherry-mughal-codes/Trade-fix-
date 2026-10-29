import { prisma } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/tenant-db";
import { requireItemMasterAccess } from "../../../items/access";
import PriceListForm from "../price-list-form";
import { ensureStandardPriceLists } from "@/lib/price-lists";

export const dynamic = "force-dynamic";

export default async function NewPriceListPage() {
  await requireItemMasterAccess();
  const organizationId = await requireOrganizationId();
  await ensureStandardPriceLists(organizationId);

  const [items, categories] = await Promise.all([
    prisma.item.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        category: true,
        defaultUnit: true,
        unitConversions: {
          select: {
            unitName: true,
            conversionFactor: true,
          },
          orderBy: { unitName: "asc" },
        },
      },
    }),
    prisma.itemCategory.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return <PriceListForm items={items} categories={categories} />;
}
