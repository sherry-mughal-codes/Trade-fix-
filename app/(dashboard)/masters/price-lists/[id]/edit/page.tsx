import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOrganizationId, withOrganization } from "@/lib/tenant-db";
import { requireItemMasterAccess } from "../../../../items/access";
import PriceListForm from "../../price-list-form";
import { ensureStandardPriceLists } from "@/lib/price-lists";

export const dynamic = "force-dynamic";

export default async function EditPriceListPage({ params }: { params: { id: string } }) {
  await requireItemMasterAccess();
  const organizationId = await requireOrganizationId();
  await ensureStandardPriceLists(organizationId);

  const [priceList, items, categories] = await Promise.all([
    prisma.priceList.findFirst({
      where: withOrganization(organizationId, { id: params.id }),
      include: {
        items: {
          select: {
            itemId: true,
            price: true,
          },
        },
      },
    }),
    prisma.item.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, category: true, defaultUnit: true },
    }),
    prisma.itemCategory.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!priceList) notFound();

  const initialData = {
    ...priceList,
    items: priceList.items.map((row) => ({
      itemId: row.itemId,
      price: Number(row.price || 0),
    })),
  };

  return (
    <PriceListForm
      initialData={JSON.parse(JSON.stringify(initialData))}
      items={items}
      categories={categories}
    />
  );
}

