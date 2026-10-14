"use client";

import { X, Mail, Phone, MapPin, Building2, ReceiptText, Coins, ShieldCheck } from "lucide-react";
import { useEffect, useRef } from "react";
import Link from "next/link";

type Customer = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  currency?: string;
  ntn?: string | null;
  strn?: string | null;
  contactPerson?: string | null;
  companyType?: { title: string } | null;
  type?: string | null;
  creditLimit?: number | null;
  creditDays?: number | null;
  creditStatus?: string | null;
  currentExposure?: number | null;
  remainingCredit?: number | null;
};

function InfoRow({ icon: Icon, value, label }: { icon: any; value: string; label: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-accent/40 p-3">
      <Icon className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground break-words">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function relationshipLabel(type?: string | null) {
  const normalized = String(type || "CUSTOMER").toUpperCase();
  if (normalized === "SUPPLIER") return "Supplier";
  if (normalized === "BOTH") return "Customer + Supplier";
  return "Customer";
}

export default function CustomerDetailsModal({
  customer,
  isOpen,
  onClose,
}: {
  customer: Customer;
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div ref={modalRef} className="bg-card rounded-lg shadow-xl border border-border w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-border bg-accent/50">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-minia-primary/10 flex items-center justify-center text-minia-primary font-bold text-xl">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">{customer.name}</h2>
              <p className="text-sm text-muted-foreground">{customer.companyType?.title || relationshipLabel(customer.type)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contact Details</h3>
              <InfoRow icon={Mail} value={customer.email || "N/A"} label="Email" />
              <InfoRow icon={Phone} value={customer.phone || "N/A"} label="Phone" />
              <InfoRow icon={MapPin} value={customer.address || "N/A"} label="Address" />
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Profile</h3>
              <InfoRow icon={Building2} value={customer.contactPerson || "N/A"} label="Contact Person" />
              <InfoRow icon={ReceiptText} value={`NTN: ${customer.ntn || "N/A"} | STRN: ${customer.strn || "N/A"}`} label="Tax Identity" />
              <InfoRow icon={Coins} value={customer.currency || "PKR"} label="Default Currency" />
              <InfoRow icon={ShieldCheck} value={customer.type === "BOTH" ? "Customer + Supplier" : customer.type || "Customer"} label="Relationship" />
            </section>
          </div>

          {(customer.creditLimit !== undefined || customer.creditStatus) ? (
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Credit Control</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <InfoRow icon={Coins} value={customer.creditLimit && customer.creditLimit > 0 ? `${customer.currency || "PKR"} ${Number(customer.creditLimit).toLocaleString()}` : "Unlimited"} label="Credit Limit" />
                <InfoRow icon={Coins} value={`${customer.currency || "PKR"} ${Number(customer.currentExposure || 0).toLocaleString()}`} label="Current Exposure" />
                <InfoRow icon={Coins} value={customer.remainingCredit === null || customer.remainingCredit === undefined ? "Unlimited" : `${customer.currency || "PKR"} ${Number(customer.remainingCredit).toLocaleString()}`} label="Remaining Credit" />
                <InfoRow icon={ShieldCheck} value={customer.creditStatus || "ACTIVE"} label={`Credit Status${customer.creditDays ? ` • ${customer.creditDays} days` : ""}`} />
              </div>
            </section>
          ) : null}
        </div>

        <div className="p-4 bg-accent/20 border-t border-border flex justify-end gap-3">
          <Link href={`/customers/${customer.id}/edit`} className="px-4 py-2 text-sm font-medium text-minia-primary bg-minia-primary/10 rounded-md hover:bg-minia-primary/20 transition-colors">
            Edit Customer
          </Link>
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground bg-background border border-border rounded-md hover:bg-accent transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
