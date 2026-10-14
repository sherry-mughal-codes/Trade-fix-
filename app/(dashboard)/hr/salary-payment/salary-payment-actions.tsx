"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { Edit, Eye, Loader2, Trash2, XCircle } from "lucide-react";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { cancelSalaryPayment, deleteCancelledSalaryPayment } from "../actions";
import SalaryPaymentDetailsModal from "./salary-payment-details-modal";

export default function SalaryPaymentActions({
  payment,
}: {
  payment: {
    id: string;
    status: string;
    paymentNumber?: string;
    date?: string;
    amount?: number;
    paymentMethod?: string;
    reference?: string;
    employee?: { name?: string } | null;
    fromAccount?: { code?: string | null; name?: string } | null;
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
    const result = await cancelSalaryPayment(payment.id);

    if (result.success) {
      toast.success("Salary payment cancelled");
      router.refresh();
    } else {
      toast.error(result.error || "Failed to cancel salary payment");
    }

    setProcessing(false);
  };

  const handleDelete = async () => {
    setProcessing(true);
    const result = await deleteCancelledSalaryPayment(payment.id);

    if (result.success) {
      toast.success("Salary payment deleted");
      router.refresh();
    } else {
      toast.error(result.error || "Failed to delete salary payment");
    }

    setProcessing(false);
  };

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setShowViewModal(true)}
          className="p-1 text-muted-foreground transition-colors hover:text-minia-primary"
          title="View"
        >
          <Eye className="h-4 w-4" />
        </button>

        {payment.status === "POSTED" && (
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

        {payment.status === "CANCELLED" && (
          <>
            <Link
              href={`/hr/salary-payment/${payment.id}/edit`}
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

      <SalaryPaymentDetailsModal
        payment={payment}
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
      />

      <ConfirmDialog
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={() => void handleCancel()}
        title="Cancel Salary Payment"
        message="This will remove the journal entry effects and mark the payment as CANCELLED."
        confirmText="Cancel Payment"
        cancelText="Keep"
        type="danger"
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => void handleDelete()}
        title="Delete Salary Payment"
        message="This will permanently delete the CANCELLED salary payment."
        confirmText="Delete"
        cancelText="Keep"
        type="danger"
      />
    </>
  );
}
