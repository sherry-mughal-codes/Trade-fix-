import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOrganizationId, withOrganization } from "@/lib/tenant-db";
import { requireItemMasterAccess } from "@/app/(dashboard)/items/access";
import { updateInventoryBatchMaster } from "../../../actions";
import MasterRecordForm from "../../../master-record-form";

export const dynamic = "force-dynamic";

export default async function EditInventoryBatchMasterPage({ params }: { params: { id: string } }) {
  await requireItemMasterAccess();
  const organizationId = await requireOrganizationId();

  const batch = await prisma.inventoryBatchMaster.findFirst({
    where: withOrganization(organizationId, { id: params.id }),
  });

  if (!batch) notFound();

  return (
    <MasterRecordForm
      initialData={JSON.parse(JSON.stringify(batch))}
      label="Batch"
      listPath="/masters/batches"
      description="Update selectable batch names used in inventory and purchase invoices."
      saveAction={updateInventoryBatchMaster.bind(null, batch.id)}
    />
  );
}
