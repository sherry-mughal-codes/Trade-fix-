import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOrganizationId, withOrganization } from "@/lib/tenant-db";
import { requireItemMasterAccess } from "@/app/(dashboard)/items/access";
import { updateItemUnit } from "../../../actions";
import MasterRecordForm from "../../../master-record-form";

export const dynamic = "force-dynamic";

export default async function EditItemUnitPage({ params }: { params: { id: string } }) {
  await requireItemMasterAccess();
  const organizationId = await requireOrganizationId();

  const unit = await prisma.itemUnit.findFirst({
    where: withOrganization(organizationId, { id: params.id }),
  });

  if (!unit) notFound();

  return (
    <MasterRecordForm
      initialData={JSON.parse(JSON.stringify(unit))}
      label="Unit"
      listPath="/masters/units"
      description="Update unit names and status for the item master dropdown."
      saveAction={updateItemUnit.bind(null, unit.id)}
    />
  );
}
