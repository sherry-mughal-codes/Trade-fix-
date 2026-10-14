"use client";

import { Edit, Eye, Trash2, CheckSquare, Download, Copy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import dynamic from 'next/dynamic';
import ConfirmDialog from "./confirm-dialog";
import { toastActionError, toastRaw as toast } from "@/components/providers/toast";
import { generateInvoicePDF } from "@/lib/generate-invoice-pdf";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const CustomerDetailsModal = dynamic(() => import('@/app/(dashboard)/customers/customer-details-modal'), {
    ssr: false,
    loading: () => null
});

const InvoiceDetailsModal = dynamic(() => import('@/app/(dashboard)/invoices/invoice-details-modal'), {
    ssr: false,
    loading: () => null
});

const StatusModal = dynamic(() => import('@/app/(dashboard)/invoices/status-modal'), {
    ssr: false,
    loading: () => null
});

const JournalDetailsModal = dynamic(() => import('@/app/(dashboard)/journal/journal-details-modal'), {
    ssr: false,
    loading: () => null
});

const PaymentDetailsModal = dynamic(() => import('@/app/(dashboard)/payments/payment-details-modal'), {
    ssr: false,
    loading: () => null
});

const EmployeeDetailsModal = dynamic(() => import('@/app/(dashboard)/hr/employees/employee-details-modal'), {
    ssr: false,
    loading: () => null
});

interface RowActionsProps {
  id: string;
  viewUrl?: string;
  editUrl?: string;
  onDelete?: () => Promise<any>;
  viewData?: any;
  type?: 'party' | 'customer' | 'supplier' | 'invoice' | 'journal' | 'payment' | 'employee' | 'item' | 'category' | 'unit' | 'batch' | 'priceList' | 'warehouse' | 'posProfile' | 'posCounter';
  itemLabel?: string;
  companySettings?: any;
  accounts?: any[];
  currencies?: any[];
}

const TYPE_LABEL: Record<NonNullable<RowActionsProps['type']>, string> = {
  party: 'Party',
  customer: 'Customer',
  supplier: 'Supplier',
  invoice: 'Invoice',
  journal: 'Journal Entry',
  payment: 'Payment',
  employee: 'Employee',
  item: 'Item',
  category: 'Category',
  unit: 'Unit',
  batch: 'Batch',
  priceList: 'Price List',
  warehouse: 'Warehouse',
  posProfile: 'POS Profile',
  posCounter: 'POS Counter',
};

function titleCase(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export default function RowActions({ id, viewUrl, editUrl, onDelete, viewData, type = 'customer', itemLabel, companySettings, accounts = [], currencies = [] }: RowActionsProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [showDeleteWithPaymentsConfirm, setShowDeleteWithPaymentsConfirm] = useState(false);
  const [paymentsToDelete, setPaymentsToDelete] = useState<string[]>([]);

  const recordLabel =
    (itemLabel && itemLabel.trim().length > 0 ? itemLabel : undefined) ??
    TYPE_LABEL[type] ??
    titleCase(String(type || 'item'));

  const handleDelete = async (confirmed = false) => {
    if (!onDelete) return;

    if (type === 'invoice' && viewData?.payments?.length > 0 && !confirmed) {
        setPaymentsToDelete(viewData.payments.map((p: any) => p.paymentNumber));
        setShowDeleteConfirm(false);
        setShowDeleteWithPaymentsConfirm(true);
        return;
    }

    try {
      setIsDeleting(true);
      const res: unknown = await onDelete();
      if (
        typeof res === "object" &&
        res !== null &&
        (res as any).ok === false
      ) {
        toastActionError(res as any, { fallback: `Failed to delete ${recordLabel.toLowerCase()}` });
        return;
      }
      if (
        typeof res === "object" &&
        res !== null &&
        typeof (res as any).ok === "boolean" &&
        (res as any).ok !== true
      ) {
        // Non-ActionResult object, safe to ignore
      }
      router.refresh();
      toast.success(`${recordLabel} deleted successfully!`);
      setShowDeleteConfirm(false);
      setShowDeleteWithPaymentsConfirm(false);
    } catch (error: any) {
      console.error("Failed to delete:", error);
      toastActionError(error, { fallback: `Failed to delete ${recordLabel.toLowerCase()}` });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleView = (e: React.MouseEvent) => {
    if (viewData) {
      e.preventDefault();
      setShowViewModal(true);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (viewData && type === 'invoice') {
      try {
        await generateInvoicePDF(viewData, companySettings);
        toast.success("Invoice PDF downloaded");
      } catch (error) {
        console.error("Failed to generate PDF:", error);
        toast.error("Failed to generate PDF");
      }
    }
  };

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <div className="flex items-center justify-end gap-2">
          {(viewUrl || viewData) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={viewUrl || "#"}
                  onClick={handleView}
                  className="p-1 text-muted-foreground hover:text-minia-primary transition-colors"
                  aria-label="Quick View"
                >
                  <Eye className="h-4 w-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Quick View</p>
              </TooltipContent>
            </Tooltip>
          )}

          {editUrl && (type !== "invoice" || viewData?.status === "DRAFT") && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={editUrl}
                  className="p-1 text-muted-foreground hover:text-[#34c38f] transition-colors"
                  aria-label="Edit"
                >
                  <Edit className="h-4 w-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Edit</p>
              </TooltipContent>
            </Tooltip>
          )}

          {type === "invoice" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={`/invoices/new?duplicate=${id}`}
                  className="p-1 text-muted-foreground hover:text-minia-primary transition-colors"
                  aria-label="Duplicate"
                >
                  <Copy className="h-4 w-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Duplicate</p>
              </TooltipContent>
            </Tooltip>
          )}

          {type === "invoice" && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleDownload}
                    className="p-1 text-muted-foreground hover:text-blue-500 transition-colors"
                    aria-label="Download PDF"
                    type="button"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Download PDF</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowStatusModal(true)}
                    className="p-1 text-muted-foreground hover:text-orange-500 transition-colors"
                    aria-label="Change Status"
                    type="button"
                  >
                    <CheckSquare className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Change Status</p>
                </TooltipContent>
              </Tooltip>
            </>
          )}

          {onDelete && (type !== "invoice" || ["DRAFT", "CANCELLED"].includes(viewData?.status)) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isDeleting}
                  className="p-1 text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50"
                  aria-label="Delete"
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Delete</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </TooltipProvider>

      {showViewModal && viewData && (
        type === 'invoice' ? (
            <InvoiceDetailsModal
                invoice={viewData}
                isOpen={showViewModal}
                onClose={() => setShowViewModal(false)}
                companySettings={companySettings}
            />
        ) : type === 'journal' ? (
            <JournalDetailsModal
                journal={viewData}
                isOpen={showViewModal}
                onClose={() => setShowViewModal(false)}
            />
        ) : type === 'payment' ? (
            <PaymentDetailsModal
                payment={viewData}
                isOpen={showViewModal}
                onClose={() => setShowViewModal(false)}
            />
        ) : type === 'employee' ? (
            <EmployeeDetailsModal
                employee={viewData}
                isOpen={showViewModal}
                onClose={() => setShowViewModal(false)}
            />
        ) : type === 'customer' || type === 'supplier' ? (
            <CustomerDetailsModal
                customer={viewData}
                isOpen={showViewModal}
                onClose={() => setShowViewModal(false)}
            />
        ) : null
        
      )}

      {showStatusModal && type === 'invoice' && viewData && (
        <StatusModal
            invoice={viewData}
            isOpen={showStatusModal}
            onClose={() => setShowStatusModal(false)}
        />
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => handleDelete(false)}
        title={`Delete ${recordLabel}`}
        message={`Are you sure you want to delete this ${recordLabel.toLowerCase()}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />

      <ConfirmDialog
        isOpen={showDeleteWithPaymentsConfirm}
        onClose={() => setShowDeleteWithPaymentsConfirm(false)}
        onConfirm={() => handleDelete(true)}
        title="Delete Invoice & Payments"
        message={`This invoice has linked payments: ${paymentsToDelete.join(', ')}. Deleting this invoice will also delete all these payments permanently. Are you sure you want to proceed?`}
        confirmText="Yes, Delete All"
        cancelText="Cancel"
        type="danger"
      />
    </>
  );
}
