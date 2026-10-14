"use client";

import { X, Calendar, User, CreditCard, Hash, FileText } from "lucide-react";
import { useEffect, useRef } from "react";

interface PaymentDetailsModalProps {
  payment: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function PaymentDetailsModal({ payment, isOpen, onClose }: PaymentDetailsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        ref={modalRef}
        className="bg-card rounded-lg shadow-xl border border-border w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-accent/50">
          <div>
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                <Hash className="h-5 w-5 text-muted-foreground" />
                {payment.paymentNumber}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Payment Details</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
            <div className="flex justify-between items-start p-4 bg-accent/50 rounded-lg border border-border">
                <div>
                    <div className="text-sm text-muted-foreground mb-1">Amount</div>
                    <div className={`text-2xl font-bold ${payment.type === 'RECEIVE' ? 'text-minia-success' : 'text-minia-danger'}`}>
                        {payment.type === 'RECEIVE' ? '+' : '-'}{payment.amount.toLocaleString()}
                    </div>
                </div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                    payment.type === 'RECEIVE' 
                        ? 'bg-minia-success/10 text-minia-success' 
                        : 'bg-minia-danger/10 text-minia-danger'
                }`}>
                    {payment.type === 'RECEIVE' ? 'Payment Received' : 'Payment Sent'}
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                            <div className="text-sm font-medium text-foreground">Date</div>
                            <div className="text-sm text-muted-foreground">{new Date(payment.date).toLocaleDateString()}</div>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                            <div className="text-sm font-medium text-foreground">Party</div>
                            <div className="text-sm text-muted-foreground">{payment.party?.name || 'Unknown'}</div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                            <div className="text-sm font-medium text-foreground">Payment Method</div>
                            <div className="text-sm text-muted-foreground">{payment.method}</div>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <Hash className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                            <div className="text-sm font-medium text-foreground">Reference</div>
                            <div className="text-sm text-muted-foreground">{payment.reference || '-'}</div>
                        </div>
                    </div>
                </div>
            </div>

            {payment.notes && (
                <div className="pt-6 border-t border-border">
                    <div className="flex items-start gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                            <div className="text-sm font-medium text-foreground mb-1">Notes</div>
                            <div className="text-sm text-muted-foreground">{payment.notes}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-accent/20 border-t border-border flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-foreground bg-background border border-border rounded-md hover:bg-accent transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
