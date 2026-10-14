import { createItemUnit } from "../../actions";
import { requireItemMasterAccess } from "@/app/(dashboard)/items/access";
import MasterRecordForm from "../../master-record-form";

export const dynamic = "force-dynamic";

export default async function NewItemUnitPage() {
  await requireItemMasterAccess();

  return (
    <MasterRecordForm
      label="Unit"
      listPath="/masters/units"
      description="Add units that should appear as selectable defaults in item master."
      saveAction={createItemUnit}
    />
  );
}
