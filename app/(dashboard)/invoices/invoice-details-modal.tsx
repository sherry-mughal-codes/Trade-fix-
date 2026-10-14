"use client";

import { X, Calendar, Wallet, FileText, User, StickyNote, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "react-hot-toast";
import { getInvoicePromises, setInvoicePromise } from "./promise-actions";

type Party = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  type: string;
  currency: string;
};

type InvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  type: string;
  status: string;
  date: Date | string;
  dueDate: Date | string | null;
  party: Party;
  currency: string;
  exchangeRate: number;
  grandTotal: number;
  baseGrandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  items?: InvoiceItem[];
  notes?: string | null;
  terms?: string | null;
};

type PaymentPromise = {
  id: string;
  promisedDate: Date | string;
  promisedAmount: number | null;
  remarks: string | null;
  status: string;
  createdAt: Date | string;
};

interface InvoiceDetailsModalProps {
  invoice: Invoice;
  isOpen: boolean;
  onClose: () => void;
  companySettings?: any;
}

export default function InvoiceDetailsModal({ invoice, isOpen, onClose, companySettings }: InvoiceDetailsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [promises, setPromises] = useState<PaymentPromise[]>([]);
  const [showPromiseForm, setShowPromiseForm] = useState(false);
  const [promisedDate, setPromisedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [promisedAmount, setPromisedAmount] = useState<number>(Number(invoice.balanceAmount || 0));
  const [promiseRemarks, setPromiseRemarks] = useState<string>("");
  const [isPending, startTransition] = useTransition();

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

  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;
    (async () => {
      const data = await getInvoicePromises(invoice.id);
      if (!isCancelled) setPromises(data as any);
    })();
    return () => {
      isCancelled = true;
    };
  }, [isOpen, invoice.id]);

  const activePromise = promises.find((p) => p.status === "ACTIVE") || null;

  const savePromise = () => {
    startTransition(async () => {
      const res = await setInvoicePromise({
        invoiceId: invoice.id,
        promisedDate,
        promisedAmount: Number.isFinite(promisedAmount) ? promisedAmount : null,
        remarks: promiseRemarks || null,
      });
      if ((res as any)?.error) {
        toast.error((res as any).error);
        return;
      }
      toast.success("Payment promise saved");
      const data = await getInvoicePromises(invoice.id);
      setPromises(data as any);
      setShowPromiseForm(false);
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        ref={modalRef}
        className="bg-card rounded-lg shadow-xl border border-border w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-accent/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-minia-primary/10 flex items-center justify-center text-minia-primary">
                <FileText className="h-5 w-5" />
            </div>
            <div>
                <h2 className="text-lg font-semibold text-foreground">{invoice.invoiceNumber}</h2>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    invoice.status === 'PAID' 
                        ? 'bg-minia-success/10 text-minia-success' 
                        : invoice.status === 'DRAFT'
                        ? 'bg-accent text-muted-foreground'
                        : 'bg-minia-warning/10 text-minia-warning'
                }`}>
                    {invoice.status}
                </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          {/* Main Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-minia-primary/5 border border-minia-primary/10">
                <p className="text-xs text-muted-foreground uppercase font-medium">Grand Total</p>
                <p className="text-xl font-bold text-minia-primary mt-1">
                    {invoice.currency} {invoice.grandTotal.toLocaleString()}
                </p>
                {invoice.exchangeRate && invoice.exchangeRate !== 1 && (
                    <div className="mt-2 pt-2 border-t border-minia-primary/10 space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Base Total ({companySettings?.baseCurrency || 'Base'}):</span>
                            <span className="font-medium">{(invoice.baseGrandTotal || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Ex. Rate:</span>
                            <span className="font-medium">{invoice.exchangeRate}</span>
                        </div>
                    </div>
                )}
            </div>
            <div className="p-4 rounded-lg bg-minia-danger/5 border border-minia-danger/10">
                <p className="text-xs text-minia-danger uppercase font-medium">Balance Due</p>
                <p className="text-xl font-bold text-minia-danger mt-1">
                    {invoice.currency} {invoice.balanceAmount.toLocaleString()}
                </p>
            </div>
          </div>

          {/* Details List */}
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Customer</p>
                <p className="text-sm font-medium text-foreground">{invoice.party?.name || "Unknown"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Invoice Date</p>
                        <p className="text-sm text-foreground">
                            {new Date(invoice.date).toLocaleDateString()}
                        </p>
                    </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Due Date</p>
                        <p className="text-sm text-foreground">
                            {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "N/A"}
                        </p>
                    </div>
                </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50">
              <Wallet className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Payment Status</p>
                <div className="flex items-center gap-4 mt-1">
                    <div className="text-sm">
                        <span className="text-muted-foreground">Paid:</span>
                        <span className="ml-1 font-medium text-minia-success">{invoice.currency} {invoice.paidAmount.toLocaleString()}</span>
                    </div>
                    <div className="h-3 w-px bg-border"></div>
                    <div className="text-sm">
                        <span className="text-muted-foreground">Type:</span>
                        <span className="ml-1 font-medium text-foreground">{invoice.type}</span>
                    </div>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          {invoice.items && invoice.items.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-accent px-4 py-2 border-b border-border">
                    <h3 className="text-sm font-semibold text-foreground">Invoice Items</h3>
                </div>
                <table className="w-full text-sm">
                    <thead className="bg-accent/50">
                        <tr>
                            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Description</th>
                            <th className="px-4 py-2 text-right font-medium text-muted-foreground">Qty</th>
                            <th className="px-4 py-2 text-right font-medium text-muted-foreground">Price</th>
                            <th className="px-4 py-2 text-right font-medium text-muted-foreground">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {invoice.items.map((item) => (
                            <tr key={item.id}>
                                <td className="px-4 py-2 text-foreground">{item.description}</td>
                                <td className="px-4 py-2 text-right text-muted-foreground">{item.quantity}</td>
                                <td className="px-4 py-2 text-right text-muted-foreground">{item.unitPrice.toLocaleString()}</td>
                                <td className="px-4 py-2 text-right font-medium text-foreground">{item.amount.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          )}

          {/* Notes + Terms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-accent px-4 py-2 border-b border-border flex items-center gap-2">
                <StickyNote className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Notes</h3>
              </div>
              <div className="p-4 min-h-[72px] text-sm whitespace-pre-wrap break-words leading-relaxed">
                {invoice.notes?.trim() ? (
                  <span className="text-foreground">{invoice.notes.trim()}</span>
                ) : (
                  <span className="text-muted-foreground italic">No notes added for this invoice.</span>
                )}
              </div>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-accent px-4 py-2 border-b border-border flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Terms &amp; Conditions</h3>
              </div>
              <div className="p-4 min-h-[72px] text-sm whitespace-pre-wrap break-words leading-relaxed">
                {(() => {
                  const effective =
                    (invoice.terms && invoice.terms.trim()) ||
                    (companySettings?.invoiceTerms && String(companySettings.invoiceTerms).trim()) ||
                    "";
                  return effective ? (
                    <span className="text-foreground">{effective}</span>
                  ) : (
                    <span className="text-muted-foreground italic">No terms &amp; conditions set for this invoice.</span>
                  );
                })()}
              </div>
            </div>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="bg-accent px-4 py-2 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Payment Promise</h3>
              <button
                type="button"
                onClick={() => setShowPromiseForm((v) => !v)}
                className="text-xs font-medium text-minia-primary hover:underline"
              >
                {showPromiseForm ? "Cancel" : "Add Promise"}
              </button>
            </div>

            <div className="p-4 space-y-4">
              {activePromise ? (
                <div className="text-sm">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-foreground">
                      Active: {new Date(activePromise.promisedDate).toLocaleDateString()}
                    </div>
                    <div className="text-muted-foreground">
                      {activePromise.promisedAmount !== null
                        ? `${invoice.currency} ${Number(activePromise.promisedAmount).toLocaleString()}`
                        : "Amount: N/A"}
                    </div>
                  </div>
                  {activePromise.remarks && (
                    <div className="text-xs text-muted-foreground mt-1">{activePromise.remarks}</div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No active promise</div>
              )}

              {showPromiseForm && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Promised Date</label>
                    <input
                      type="date"
                      value={promisedDate}
                      onChange={(e) => setPromisedDate(e.target.value)}
                      onClick={(e) => (e.target as HTMLInputElement).showPicker()}
                      className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-transparent"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Promised Amount</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={promisedAmount}
                      onChange={(e) => setPromisedAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-transparent"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-3">
                    <label className="text-xs font-medium text-muted-foreground">Remarks</label>
                    <input
                      type="text"
                      value={promiseRemarks}
                      onChange={(e) => setPromiseRemarks(e.target.value)}
                      className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-transparent"
                      placeholder="Remarks"
                    />
                  </div>
                  <div className="md:col-span-3 flex justify-end">
                    <button
                      type="button"
                      onClick={savePromise}
                      disabled={isPending}
                      className="px-4 py-2 text-sm font-medium text-white bg-minia-primary rounded-md hover:brightness-95 disabled:opacity-50"
                    >
                      Save Promise
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-accent/20 border-t border-border flex justify-end gap-3 flex-shrink-0">
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
