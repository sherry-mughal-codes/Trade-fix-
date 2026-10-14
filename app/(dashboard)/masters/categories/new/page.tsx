import { createItemCategory } from "../../actions";
import { requireItemMasterAccess } from "@/app/(dashboard)/items/access";
import MasterRecordForm from "../../master-record-form";

export const dynamic = "force-dynamic";

export default async function NewItemCategoryPage() {
  await requireItemMasterAccess();

  return (
    <MasterRecordForm
      label="Category"
      listPath="/masters/categories"
      description="Add item categories that should appear in the item master dropdown."
      saveAction={createItemCategory}
    />
  );
}
