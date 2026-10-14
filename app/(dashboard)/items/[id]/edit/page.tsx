import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOrganizationId, withOrganization } from "@/lib/tenant-db";
import { requireItemMasterAccess } from "../../access";
import ItemForm from "../../item-form";

export const dynamic = "force-dynamic";

export default async function EditItemPage({ params }: { params: { id: string } }) {
  await requireItemMasterAccess();
  const organizationId = await requireOrganizationId();

  const [item, units, categories] = await Promise.all([
    prisma.item.findFirst({
      where: withOrganization(organizationId, { id: params.id }),
      include: {
        unitConversions: {
          orderBy: { unitName: "asc" },
        },
      },
    }),
    prisma.itemUnit.findMany({ where: { organizationId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.itemCategory.findMany({ where: { organizationId, isActive: true }, orderBy: { name: "asc" } }),
  ]);

  if (!item) notFound();

  return <ItemForm initialData={JSON.parse(JSON.stringify(item))} units={units} categories={categories} />;
}
