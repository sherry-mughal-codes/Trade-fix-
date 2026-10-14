import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOrganizationId, withOrganization } from "@/lib/tenant-db";
import { requireItemMasterAccess } from "@/app/(dashboard)/items/access";
import { updateItemCategory } from "../../../actions";
import MasterRecordForm from "../../../master-record-form";

export const dynamic = "force-dynamic";

export default async function EditItemCategoryPage({ params }: { params: { id: string } }) {
  await requireItemMasterAccess();
  const organizationId = await requireOrganizationId();

  const category = await prisma.itemCategory.findFirst({
    where: withOrganization(organizationId, { id: params.id }),
  });

  if (!category) notFound();

  return (
    <MasterRecordForm
      initialData={JSON.parse(JSON.stringify(category))}
      label="Category"
      listPath="/masters/categories"
      description="Update category names and status for the item master dropdown."
      saveAction={updateItemCategory.bind(null, category.id)}
    />
  );
}
