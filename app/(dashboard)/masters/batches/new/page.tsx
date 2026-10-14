import { createInventoryBatchMaster } from "../../actions";
import { requireItemMasterAccess } from "@/app/(dashboard)/items/access";
import MasterRecordForm from "../../master-record-form";

export const dynamic = "force-dynamic";

export default async function NewInventoryBatchMasterPage() {
  await requireItemMasterAccess();

  return (
    <MasterRecordForm
      label="Batch"
      listPath="/masters/batches"
      description="Add batch names that should appear in inventory and purchase invoice dropdowns."
      saveAction={createInventoryBatchMaster}
    />
  );
}
