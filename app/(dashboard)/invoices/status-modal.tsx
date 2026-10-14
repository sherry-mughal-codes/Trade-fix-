"use client";

import { X, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { updateInvoiceStatus } from "./status-actions";
import { toast } from "react-hot-toast";
import ConfirmDialog from "@/components/ui/confirm-dialog";

type Invoice = {
  id: string;
  invoiceNumber: string;
  status: string;
};

interface StatusModalProps {
  invoice: Invoice;
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft', color: 'bg-gray-100 text-gray-600' },
  { value: 'SENT', label: 'Sent', color: 'bg-minia-primary/10 text-minia-primary' },
  { value: 'PAID', label: 'Paid', color: 'bg-[#34c38f]/10 text-[#34c38f]' },
  { value: 'CANCELLED', label: 'Cancelled', color: 'bg-red-100 text-red-600' },
  { value: 'OVERDUE', label: 'Overdue', color: 'bg-[#f1b44c]/10 text-[#f1b44c]' },
];

function getAvailableStatuses(currentStatus: string) {
    if (currentStatus === 'DRAFT') {
        return STATUS_OPTIONS.filter(opt => opt.value === 'SENT');
    } else if (currentStatus === 'SENT') {
        return STATUS_OPTIONS.filter(opt => opt.value === 'CANCELLED');
    } else if (currentStatus === 'PARTIALLY_PAID') {
        return STATUS_OPTIONS.filter(opt => opt.value === 'CANCELLED');
    } else if (currentStatus === 'PAID') {
        return STATUS_OPTIONS.filter(opt => opt.value === 'CANCELLED');
    } else if (currentStatus === 'CANCELLED') {
         // Maybe allow revert to SENT or DRAFT? For now, let's say just DRAFT to restart cycle.
         return STATUS_OPTIONS.filter(opt => opt.value === 'DRAFT');
    }
    // PAID or OVERDUE or others might not be manually changeable via this simple modal in this strict flow,
    // or maybe PAID comes from payments.
    // If PAID, usually we don't manually change status back unless we delete payment.
    return [];
}

export default function StatusModal({ invoice, isOpen, onClose }: StatusModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [selectedStatus, setSelectedStatus] = useState(invoice.status);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
        setSelectedStatus(invoice.status);
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose, invoice.status]);

  const handleSave = async () => {
    if (selectedStatus === invoice.status) {
        onClose();
        return;
    }

    // Show custom confirmation
    setShowConfirm(true);
  };

  const confirmUpdate = async () => {
    setLoading(true);

    try {
        await updateInvoiceStatus(invoice.id, selectedStatus);
        onClose();
        toast.success("Status updated successfully!");
    } catch (error) {
        console.error("Failed to update status:", error);
        toast.error("Failed to update status. Please try again.");
    } finally {
        setLoading(false);
    }
  };

  const availableStatuses = getAvailableStatuses(invoice.status);

  // If no available next statuses, maybe just show current or info?
  // But based on request, we only show specific next steps.

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
        <div 
          ref={modalRef}
          className="bg-card rounded-lg shadow-xl border border-border w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-border bg-accent/50">
              <h3 className="text-sm font-semibold text-foreground">Change Status</h3>
              <button 
                  onClick={onClose}
                  className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
              >
                  <X className="h-4 w-4" />
              </button>
          </div>

          <div className="p-6 space-y-4">
              <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-2">
                      Invoice
                  </label>
                  <p className="text-lg font-semibold text-foreground">{invoice.invoiceNumber}</p>
              </div>

              <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-2">
                      Next Status
                  </label>
                  <div className="flex flex-wrap gap-2">
                      {availableStatuses.length > 0 ? (
                          availableStatuses.map((option) => (
                          <button
                              key={option.value}
                              onClick={() => setSelectedStatus(option.value)}
                              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all border-2 ${
                                  selectedStatus === option.value
                                      ? `border-minia-primary ${option.color}`
                                      : 'border-transparent bg-accent text-muted-foreground hover:bg-accent/80'
                              }`}
                          >
                              {option.label}
                              {selectedStatus === option.value && (
                                  <Check className="inline-block ml-1.5 h-3 w-3" />
                              )}
                          </button>
                      ))
                      ) : (
                          <p className="text-sm text-muted-foreground italic">No further status changes allowed.</p>
                      )}
                  </div>
              </div>
          </div>

          <div className="p-4 bg-accent/20 border-t border-border flex justify-end gap-3">
              <button 
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-foreground bg-background border border-border rounded-md hover:bg-accent transition-colors"
                  disabled={loading}
              >
                  Cancel
              </button>
              <button
                  onClick={handleSave}
                  disabled={loading || selectedStatus === invoice.status}
                  className="px-4 py-2 text-sm font-medium text-primary-foreground bg-minia-primary rounded-md hover:bg-minia-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                  {loading ? 'Saving...' : 'Update Status'}
              </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={confirmUpdate}
        title="Confirm Status Change"
        message={`Are you sure you want to change the status from ${invoice.status} to ${selectedStatus}?`}
        confirmText={loading ? "Updating..." : "Confirm Update"}
        cancelText="Cancel"
        type="warning"
      />
    </>
  );
}
