"use client";

import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import RowActions from "@/components/ui/row-actions";
import { deleteEmployee } from "../actions";

export default function EmployeeRowActions({
  id,
  editUrl,
  canDelete,
  viewData,
}: {
  id: string;
  editUrl?: string;
  canDelete: boolean;
  viewData: any;
}) {
  const router = useRouter();

  return (
    <RowActions
      id={id}
      editUrl={editUrl}
      viewData={viewData}
      type="employee"
      onDelete={
        canDelete
          ? async () => {
              const result = await deleteEmployee(id);
              if (result?.error) {
                toast.error(result.error);
                return;
              }
              toast.success("Employee deleted");
              router.refresh();
            }
          : undefined
      }
    />
  );
}
