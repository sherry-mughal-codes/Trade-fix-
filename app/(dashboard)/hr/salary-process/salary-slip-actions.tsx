"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { Edit, Eye, Loader2, Trash2, XCircle } from "lucide-react";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { cancelSalarySlip, deleteCancelledSalarySlip } from "../actions";
import SalarySlipDetailsModal from "./salary-slip-details-modal";

export default function SalarySlipActions({
  slip,
}: {
  slip: {
    id: string;
    status: string;
    month?: number;
    year?: number;
    employee?: { name?: string } | null;
    createdAt?: string;
    updatedAt?: string;
    ctcAmount?: number;
    payableAmount?: number;
    absentDays?: number;
    bonus?: number;
    deduction?: number;
    finalPayableAmount?: number;
    journalEntry?: { entryNumber?: string } | null;
  };
}) {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);

  const handleCancel = async () => {
    setProcessing(true);
    const result = await cancelSalarySlip(slip.id);

    if (result.success) {
      toast.success("Salary slip cancelled");
      router.refresh();
    } else {
      toast.error(result.error || "Failed to cancel salary slip");
    }

    setProcessing(false);
  };

  const handleDelete = async () => {
    setProcessing(true);
    const result = await deleteCancelledSalarySlip(slip.id);

    if (result.success) {
      toast.success("Salary slip deleted");
      router.refresh();
    } else {
      toast.error(result.error || "Failed to delete salary slip");
    }

    setProcessing(false);
  };

  return (
    <>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setShowViewModal(true)}
          className="p-1 text-muted-foreground transition-colors hover:text-minia-primary"
          title="View"
        >
          <Eye className="h-4 w-4" />
        </button>

        {slip.status === "POSTED" && (
          <button
            type="button"
            disabled={processing}
            onClick={() => setShowCancelConfirm(true)}
            className="p-1 text-muted-foreground transition-colors hover:text-orange-500 disabled:opacity-50"
            title="Cancel"
          >
            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
          </button>
        )}

        {slip.status === "CANCELLED" && (
          <>
            <Link
              href={`/hr/salary-process/${slip.id}/edit`}
              className="p-1 text-muted-foreground transition-colors hover:text-minia-success"
              title="Edit"
            >
              <Edit className="h-4 w-4" />
            </Link>
            <button
              type="button"
              disabled={processing}
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1 text-muted-foreground transition-colors hover:text-red-500 disabled:opacity-50"
              title="Delete"
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
          </>
        )}
      </div>

      <SalarySlipDetailsModal
        slip={slip}
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
      />

      <ConfirmDialog
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={() => void handleCancel()}
        title="Cancel Salary Slip"
        message="This will remove the journal entry effects and mark the slip as CANCELLED."
        confirmText="Cancel Slip"
        cancelText="Keep"
        type="danger"
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => void handleDelete()}
        title="Delete Salary Slip"
        message="This will permanently delete the CANCELLED salary slip."
        confirmText="Delete"
        cancelText="Keep"
        type="danger"
      />
    </>
  );
}
