import { createInventoryWarehouse } from "../../actions";
import { requireItemMasterAccess } from "@/app/(dashboard)/items/access";
import MasterRecordForm from "../../master-record-form";

export const dynamic = "force-dynamic";

export default async function NewInventoryWarehousePage() {
  await requireItemMasterAccess();

  return (
    <MasterRecordForm
      label="Warehouse"
      listPath="/masters/warehouses"
      description="Add warehouse names that should appear as dropdown options in inventory and purchase invoices."
      saveAction={createInventoryWarehouse}
    />
  );
}
