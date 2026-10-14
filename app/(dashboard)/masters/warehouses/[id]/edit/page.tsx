import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOrganizationId, withOrganization } from "@/lib/tenant-db";
import { requireItemMasterAccess } from "@/app/(dashboard)/items/access";
import { updateInventoryWarehouse } from "../../../actions";
import MasterRecordForm from "../../../master-record-form";

export const dynamic = "force-dynamic";

export default async function EditInventoryWarehousePage({ params }: { params: { id: string } }) {
  await requireItemMasterAccess();
  const organizationId = await requireOrganizationId();

  const warehouse = await prisma.inventoryWarehouse.findFirst({
    where: withOrganization(organizationId, { id: params.id }),
  });

  if (!warehouse) notFound();

  return (
    <MasterRecordForm
      initialData={JSON.parse(JSON.stringify(warehouse))}
      label="Warehouse"
      listPath="/masters/warehouses"
      description="Update warehouse names and status for the inventory dropdowns."
      saveAction={updateInventoryWarehouse.bind(null, warehouse.id)}
    />
  );
}
