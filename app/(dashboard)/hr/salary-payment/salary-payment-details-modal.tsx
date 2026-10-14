"use client";

import { useEffect, useRef } from "react";
import { Calendar, CreditCard, FileText, User, X } from "lucide-react";

export default function SalaryPaymentDetailsModal({
  payment,
  isOpen,
  onClose,
}: {
  payment: any;
  isOpen: boolean;
  onClose: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen || !payment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        ref={modalRef}
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl animate-in zoom-in-95 duration-200"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border bg-accent/50 p-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Salary Payment</h2>
            <div className="text-sm text-muted-foreground">{payment.paymentNumber}</div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3 rounded-lg bg-accent/50 p-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Employee</span>
                <span className="text-sm font-medium text-foreground">
                  {payment.employee?.name || "-"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-accent/50 p-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Date</span>
                <span className="text-sm font-medium text-foreground">
                  {payment.date ? new Date(payment.date).toLocaleDateString() : "-"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-accent/50 p-3">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Method</span>
                <span className="text-sm font-medium text-foreground">
                  {payment.paymentMethod || "-"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-accent/50 p-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Status</span>
                <span className="text-sm font-medium text-foreground">{payment.status || "-"}</span>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            <div className="border-b border-border bg-muted/50 px-4 py-3 text-sm font-medium text-foreground">
              Payment
            </div>
            <div className="grid grid-cols-1 gap-4 p-4 text-sm md:grid-cols-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">From Account</span>
                <span className="font-medium text-foreground">
                  {payment.fromAccount?.code ? `${payment.fromAccount.code} - ` : ""}
                  {payment.fromAccount?.name || "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-bold text-foreground">
                  {Number(payment.amount || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between md:col-span-2">
                <span className="text-muted-foreground">Reference</span>
                <span className="font-medium text-foreground">{payment.reference || "-"}</span>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            <div className="border-b border-border bg-muted/50 px-4 py-3 text-sm font-medium text-foreground">
              Accounting
            </div>
            <div className="p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Journal Entry</span>
                <span className="font-medium text-foreground">
                  {payment.journalEntry?.entryNumber || "-"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-border bg-accent/20 p-4">
          <button
            onClick={onClose}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
