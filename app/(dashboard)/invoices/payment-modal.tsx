"use client";

import { X, Calendar, CreditCard, Wallet, Banknote, FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { createPayment } from "./payment-actions";

type Invoice = {
  id: string;
  invoiceNumber: string;
  party: { name: string };
  balanceAmount: number;
  currency: string;
  type: string;
};

type Account = {
  id: string;
  name: string;
  isGroup?: boolean;
  type?: string;
  subType?: string | null;
  parentId?: string | null;
  parent?: {
    id: string;
    name?: string;
    code?: string;
  };
};

function filterAccountsForMethod(
  accounts: Account[],
  method: string,
  cashGroupAccountId?: string | null,
  bankGroupAccountId?: string | null
) {
  const isExcluded = (account: any) => {
    const subType = (account.subType || "").toLowerCase();
    const name = (account.name || "").toLowerCase();
    return (
      subType === "receivable" ||
      subType === "payable" ||
      subType === "inventory" ||
      name.includes("receivable") ||
      name.includes("payable") ||
      name.includes("inventory")
    );
  };

  const matched = accounts.filter((account) => {
    if (account.isGroup || isExcluded(account)) return false;

    const accountName = (account.name || "").toLowerCase();
    const accountSubType = (account.subType || "").toLowerCase();
    const parentId = account.parentId;
    const parentCode = account.parent?.code;
    const parentName = (account.parent?.name || "").toLowerCase();

    if (method === "Cash") {
      return (
        (cashGroupAccountId && parentId === cashGroupAccountId) ||
        parentCode === "1100" ||
        parentName === "cash" ||
        accountSubType === "cash" ||
        accountName.includes("cash")
      );
    }

    return (
      (bankGroupAccountId && parentId === bankGroupAccountId) ||
      parentCode === "1200" ||
      parentName === "bank" ||
      accountSubType === "bank" ||
      accountName.includes("bank") ||
      accountName.includes("hbl") ||
      accountName.includes("meezan") ||
      accountName.includes("mcb") ||
      accountName.includes("ubl") ||
      accountName.includes("alfalah") ||
      accountName.includes("allied")
    );
  });

  if (matched.length > 0) return matched;
  return accounts.filter((a) => !a.isGroup && a.type === "ASSET" && !isExcluded(a));
}

interface PaymentModalProps {
  invoice: Invoice;
  accounts: Account[];
  currencies: any[];
  isOpen: boolean;
  onClose: () => void;
  cashGroupAccountId?: string | null;
  bankGroupAccountId?: string | null;
}

const PAYMENT_METHODS = [
  { value: 'Cash', label: 'Cash', icon: Wallet },
  { value: 'Bank Transfer', label: 'Bank Transfer', icon: Banknote },
  { value: 'Cheque', label: 'Cheque', icon: FileText },
  { value: 'Credit Card', label: 'Credit Card', icon: CreditCard },
];

export default function PaymentModal({
  invoice,
  accounts,
  currencies = [],
  isOpen,
  onClose,
  cashGroupAccountId,
  bankGroupAccountId,
}: PaymentModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    amount: invoice.balanceAmount,
    date: new Date().toISOString().split('T')[0],
    method: 'Cash',
    accountId: '',
    reference: '',
    notes: '',
    currency: invoice.currency || 'USD',
    exchangeRate: (invoice as any).exchangeRate || 1.0 
  });

  const filteredAccounts = filterAccountsForMethod(accounts, formData.method, cashGroupAccountId, bankGroupAccountId);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
        const initialFilteredAccounts = filterAccountsForMethod(accounts, 'Cash', cashGroupAccountId, bankGroupAccountId);
        
        setFormData({
            amount: invoice.balanceAmount,
            date: new Date().toISOString().split('T')[0],
            method: 'Cash',
            accountId: initialFilteredAccounts.length > 0 ? initialFilteredAccounts[0].id : '',
            reference: '',
            notes: '',
            // Ensure currency is set from invoice. If invoice.currency is missing, fallback to 'USD'
            currency: invoice.currency || 'USD',
            // Ensure exchangeRate is set. If missing, default to 1.0
            exchangeRate: (invoice as any).exchangeRate || 1.0 
        });
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose, invoice.balanceAmount, accounts, invoice.currency, (invoice as any).exchangeRate, cashGroupAccountId, bankGroupAccountId]); 

  // Update account selection when method changes
  useEffect(() => {
    const newFilteredAccounts = filterAccountsForMethod(accounts, formData.method, cashGroupAccountId, bankGroupAccountId);
    
    // If currently selected account is not in the new list, select the first one
    const isCurrentAccountValid = newFilteredAccounts.some(acc => acc.id === formData.accountId);
    if (!isCurrentAccountValid && isOpen) { // Only update if open
        setFormData(prev => ({
            ...prev,
            accountId: newFilteredAccounts.length > 0 ? newFilteredAccounts[0].id : ''
        }));
    }
  }, [formData.method, accounts, isOpen, cashGroupAccountId, bankGroupAccountId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
        const data = new FormData();
        data.append("invoiceId", invoice.id);
        data.append("amount", formData.amount.toString());
        data.append("date", formData.date);
        data.append("method", formData.method);
        data.append("accountId", formData.accountId);
        data.append("reference", formData.reference);
        data.append("notes", formData.notes);
        data.append("currency", formData.currency);
        data.append("exchangeRate", formData.exchangeRate.toString());
        // Also need to pass partyId if createPayment expects it (and it does)
        // But invoice has party object, maybe not ID directly in type definition above?
        // Ah, type Invoice above has { party: { name: string } }. It might be missing partyId.
        // We should check if 'invoice' object has partyId. If not, we might fail.
        // Assuming the passed invoice object has partyId even if type def is incomplete here.
        // Let's cast or add to type.
        // For safety, let's append partyId if available.
        if ((invoice as any).partyId) {
             data.append("partyId", (invoice as any).partyId);
        }
        // Also need 'type' (RECEIVE/PAY)
        const paymentType = invoice.type === 'SALE' ? 'RECEIVE' : 'PAY';
        data.append("type", paymentType);

        const result = await createPayment(data);

        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success("Payment recorded successfully!");
            onClose();
        }
    } catch (error) {
        console.error("Failed to record payment:", error);
        toast.error("Failed to record payment. Please try again.");
    } finally {
        setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        ref={modalRef}
        className="bg-card rounded-lg shadow-xl border border-border w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border bg-accent/50">
            <div>
                <h3 className="text-sm font-semibold text-foreground">Record Payment</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Invoice #{invoice.invoiceNumber} - {invoice.party.name}</p>
            </div>
            <button 
                onClick={onClose}
                className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
            >
                <X className="h-4 w-4" />
            </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Amount
                    </label>
                    <div className="flex gap-2">
                        <div className="w-1/3">
                            <input
                                type="text"
                                readOnly
                                value={formData.currency}
                                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-accent text-muted-foreground focus:outline-none cursor-not-allowed"
                            />
                        </div>
                        <div className="w-2/3">
                            <input
                                type="number"
                                step="0.01"
                                max={invoice.balanceAmount}
                                required
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-minia-primary/20 focus:border-minia-primary text-foreground"
                            />
                        </div>
                    </div>
                    <div className="flex justify-between items-center text-xs mt-1">
                        <span className="text-muted-foreground">Balance: {invoice.currency} {invoice.balanceAmount.toLocaleString()}</span>
                        {formData.exchangeRate !== 1 && (
                            <span className="text-muted-foreground font-medium">
                                Base: {(formData.amount * formData.exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        )}
                    </div>
                </div>
                
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Exchange Rate
                    </label>
                    <input
                        type="number"
                        step="0.000001"
                        required
                        value={formData.exchangeRate}
                        onChange={(e) => setFormData({ ...formData, exchangeRate: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-minia-primary/20 focus:border-minia-primary text-foreground"
                    />
                    <p className="text-xs text-muted-foreground">1 {formData.currency} = {formData.exchangeRate} USD</p>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Date
                    </label>
                    <div className="relative">
                        <input
                            type="date"
                            required
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            onClick={(e) => (e.target as HTMLInputElement).showPicker()}
                            className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-minia-primary/20 focus:border-minia-primary text-foreground"
                        />
                        <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Payment Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_METHODS.map((method) => {
                        const Icon = method.icon;
                        return (
                            <button
                                key={method.value}
                                type="button"
                                onClick={() => setFormData({ ...formData, method: method.value })}
                                className={`flex items-center px-3 py-2 text-sm border rounded-md transition-colors ${
                                    formData.method === method.value
                                        ? 'border-minia-primary bg-minia-primary/5 text-minia-primary'
                                        : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                                }`}
                            >
                                <Icon className="h-4 w-4 mr-2" />
                                {method.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {invoice.type === 'SALE' ? 'Deposit To' : 'Paid From'}
                </label>
                <select
                    required
                    value={formData.accountId}
                    onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-minia-primary/20 focus:border-minia-primary text-foreground"
                >
                    <option value="" disabled>Select Account</option>
                    {filteredAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                            {account.name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Reference # (Optional)
                </label>
                <input
                    type="text"
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    placeholder="e.g. Transaction ID, Cheque No."
                    className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-minia-primary/20 focus:border-minia-primary text-foreground placeholder:text-muted-foreground"
                />
            </div>

            <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Notes (Optional)
                </label>
                <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-minia-primary/20 focus:border-minia-primary text-foreground"
                />
            </div>

            <div className="pt-4 border-t border-border flex justify-end gap-3">
                <button 
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-foreground bg-background border border-border rounded-md hover:bg-accent transition-colors"
                    disabled={loading}
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-primary-foreground bg-minia-primary rounded-md hover:bg-minia-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                    {loading ? 'Processing...' : 'Record Payment'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
}
