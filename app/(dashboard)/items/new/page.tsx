import { prisma } from "@/lib/prisma";
import { requireOrganizationId } from "@/lib/tenant-db";
import { requireItemMasterAccess } from "../access";
import ItemForm from "../item-form";

export const dynamic = "force-dynamic";

export default async function NewItemPage() {
  await requireItemMasterAccess();
  const organizationId = await requireOrganizationId();
  const [units, categories] = await Promise.all([
    prisma.itemUnit.findMany({ where: { organizationId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.itemCategory.findMany({ where: { organizationId, isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return <ItemForm units={units} categories={categories} />;
}
