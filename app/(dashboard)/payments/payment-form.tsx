"use client";

import { useState, useEffect } from "react";
import { Loader2, ArrowLeft, Calendar, Info } from "lucide-react";
import Link from "next/link";
import { createPayment, updatePayment } from "./actions";
import { getUnpaidInvoices } from "./payment-actions";
import { toast } from "react-hot-toast";
import Select from "react-select";

interface PaymentFormProps {
  parties: any[];
  currencies: any[];
  accounts: any[];
  initialData?: any;
  cashGroupAccountId?: string | null;
  bankGroupAccountId?: string | null;
}

export default function PaymentForm({
  parties,
  currencies,
  accounts,
  initialData,
  cashGroupAccountId,
  bankGroupAccountId,
}: PaymentFormProps) {
  const [loading, setLoading] = useState(false);
  const [selectedPartyId, setSelectedPartyId] = useState(initialData?.partyId || "");
  const [paymentType, setPaymentType] = useState(initialData?.type || "RECEIVE");
  const [method, setMethod] = useState(initialData?.method || "Bank Transfer");
  const [selectedAccountId, setSelectedAccountId] = useState(initialData?.accountId || "");
  const [selectedCurrency, setSelectedCurrency] = useState(initialData?.currency || "USD");
  const [exchangeRate, setExchangeRate] = useState(initialData?.exchangeRate || 1.0);
  
  const [selectedInvoices, setSelectedInvoices] = useState<{ id: string; amount: number }[]>([]);
  const [totalAllocated, setTotalAllocated] = useState(0);
  const [unpaidInvoices, setUnpaidInvoices] = useState<any[]>([]);
  const [fetchingInvoices, setFetchingInvoices] = useState(false);

  const filteredAccounts = accounts.filter((account) => {
    if (account.isGroup) return false;
    const accountName = (account.name || "").toLowerCase();
    const accountSubType = (account.subType || "").toLowerCase();
    if (
      accountSubType === "receivable" ||
      accountSubType === "payable" ||
      accountSubType === "inventory" ||
      accountName.includes("receivable") ||
      accountName.includes("payable") ||
      accountName.includes("inventory")
    ) {
      return false;
    }

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

  const displayAccounts = filteredAccounts.length > 0 ? filteredAccounts : accounts.filter((a) => !a.isGroup);

  useEffect(() => {
    // If currently selected account is not in the new list, select the first one
    const isCurrentAccountValid = displayAccounts.some(acc => acc.id === selectedAccountId);
    if (!isCurrentAccountValid) {
        setSelectedAccountId(displayAccounts.length > 0 ? displayAccounts[0].id : '');
    }
  }, [method, accounts, displayAccounts, selectedAccountId]);

  useEffect(() => {
    if (selectedPartyId) {
        if (!initialData) {
            const party = parties.find(p => p.id === selectedPartyId);
            if (party && party.currency) {
                setSelectedCurrency(party.currency);
            }
        }

        setFetchingInvoices(true);
        const invoiceType = paymentType === "RECEIVE" ? "SALE" : "PURCHASE";
        
        getUnpaidInvoices(selectedPartyId, invoiceType)
            .then(invoices => {
                setUnpaidInvoices(invoices);
                if (!initialData) {
                    setSelectedInvoices([]);
                } else if (initialData.invoiceId) {
                    // Pre-select linked invoice for edit
                    // But user said "no update needed for the record update popup for now".
                    // So we might keep edit mode simple or just support it.
                    // Let's support it minimally.
                    const inv = invoices.find((i: any) => i.id === initialData.invoiceId);
                    if (inv) {
                        setSelectedInvoices([{ id: inv.id, amount: initialData.amount }]); // Assuming full payment amount allocated
                    }
                }
            })
            .catch(err => console.error(err))
            .finally(() => setFetchingInvoices(false));
    } else {
        setUnpaidInvoices([]);
        setSelectedInvoices([]);
    }
  }, [selectedPartyId, paymentType, parties, initialData]);

  const [amount, setAmount] = useState(initialData?.amount || 0);

  useEffect(() => {
    const total = selectedInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    setTotalAllocated(total);
    // If user has selected invoices, auto-update main amount if it wasn't manually set?
    // Or just always update main amount to match sum of allocated if > 0.
    if (total > 0) {
        setAmount(total);
    }
  }, [selectedInvoices]);

  const handleInvoiceToggle = (invoiceId: string, balanceAmount: number) => {
    setSelectedInvoices(prev => {
        const exists = prev.find(i => i.id === invoiceId);
        if (exists) {
            return prev.filter(i => i.id !== invoiceId);
        } else {
            return [...prev, { id: invoiceId, amount: balanceAmount }]; // Default to full balance
        }
    });
  };

  const handleInvoiceAmountChange = (invoiceId: string, newAmount: number) => {
    setSelectedInvoices(prev => prev.map(i => 
        i.id === invoiceId ? { ...i, amount: newAmount } : i
    ));
  };

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);

    try {
      const currentAmount = parseFloat(formData.get("amount") as string);
      const allocatedTotal = selectedInvoices.reduce((sum, i) => sum + i.amount, 0);

      // Validation: If invoices are selected, sum must match Total Amount
      if (selectedInvoices.length > 0 && Math.abs(currentAmount - allocatedTotal) > 0.01) {
          toast.error(`Total Amount (${currentAmount.toLocaleString()}) must equal sum of allocated invoices (${allocatedTotal.toLocaleString()})`);
          setLoading(false);
          return;
      }

      // Append selected invoices to form data
      formData.append("invoicesData", JSON.stringify(selectedInvoices));

      let result;
      if (initialData) {
        result = await updatePayment(initialData.id, formData);
      } else {
        result = await createPayment(formData);
      }

      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(`Payment ${initialData ? 'updated' : 'recorded'} successfully!`);
      }
    } catch (err: any) {
      // Show exact error from server if available, otherwise generic
      const msg = err.message || "Something went wrong. Please try again.";
      console.error("Payment submission error:", err);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const selectedInvoice = unpaidInvoices.find(inv => inv.id === (initialData?.invoiceId || ""));

  return (
    <form action={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/payments"
            className="p-2 hover:bg-accent rounded-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {initialData ? 'Edit Payment' : 'Record Payment'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {initialData ? 'Update payment details' : 'Record a new payment'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/payments"
            className="px-4 py-2 text-sm font-medium text-foreground bg-background border border-input rounded-md hover:bg-accent"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center px-4 py-2 bg-minia-primary text-white text-sm font-medium rounded-md hover:brightness-95 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Payment Type</label>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="type"
                                value="RECEIVE"
                                checked={paymentType === "RECEIVE"}
                                onChange={() => {
                                    setPaymentType("RECEIVE");
                                    setSelectedInvoices([]);
                                }}
                                className="w-4 h-4 text-minia-primary focus:ring-minia-primary border-input"
                            />
                            <span className="text-sm text-foreground">Receive Money</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="type"
                                value="PAY"
                                checked={paymentType === "PAY"}
                                onChange={() => {
                                    setPaymentType("PAY");
                                    setSelectedInvoices([]);
                                }}
                                className="w-4 h-4 text-minia-primary focus:ring-minia-primary border-input"
                            />
                            <span className="text-sm text-foreground">Pay Money</span>
                        </label>
                    </div>
                </div>

                <div className="space-y-2">
                    <label htmlFor="partyId" className="text-sm font-medium text-foreground">
                        Party <span className="text-red-500">*</span>
                    </label>
                    <Select
                        id="partyId"
                        name="partyId"
                        required
                        options={parties.map((party) => ({
                            value: party.id,
                            label: `${party.name} (${party.type})`
                        }))}
                        value={selectedPartyId ? {
                            value: selectedPartyId,
                            label: parties.find(p => p.id === selectedPartyId) 
                                ? `${parties.find(p => p.id === selectedPartyId)?.name} (${parties.find(p => p.id === selectedPartyId)?.type})`
                                : ""
                        } : null}
                        onChange={(option) => {
                            setSelectedPartyId(option?.value || "");
                            setSelectedInvoices([]);
                        }}
                        className="react-select-container"
                        classNamePrefix="react-select"
                        placeholder="Select a party..."
                    />
                    <input type="hidden" name="partyId" value={selectedPartyId} />
                </div>

                <div className="space-y-2">
                    <label htmlFor="amount" className="text-sm font-medium text-foreground">
                        Amount <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                        <div className="w-1/3">
                            <select
                                name="currency"
                                value={selectedCurrency}
                                onChange={(e) => setSelectedCurrency(e.target.value)}
                                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-transparent"
                            >
                                {currencies.map((c) => (
                                    <option key={c.id} value={c.code}>
                                        {c.code}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="w-2/3 relative">
                            <input
                                type="number"
                                id="amount"
                                name="amount"
                                required
                                min="0.01"
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-transparent"
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label htmlFor="exchangeRate" className="text-sm font-medium text-foreground">
                        Exchange Rate <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="number"
                        id="exchangeRate"
                        name="exchangeRate"
                        required
                        min="0.000001"
                        step="0.000001"
                        value={exchangeRate}
                        onChange={(e) => setExchangeRate(parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-transparent"
                        placeholder="1.0"
                    />
                    <div className="flex justify-between items-center text-xs text-muted-foreground mt-1">
                        <span>1 {selectedCurrency} = {exchangeRate} Base Currency</span>
                        {exchangeRate !== 1 && (
                            <span className="font-medium text-minia-primary">
                                Base Total: {(amount * exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
                <div className="space-y-2">
                    <label htmlFor="date" className="text-sm font-medium text-foreground">
                        Date <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <input
                            type="date"
                            id="date"
                            name="date"
                            required
                            defaultValue={initialData?.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                            onClick={(e) => (e.target as HTMLInputElement).showPicker()}
                            className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-transparent"
                        />
                        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                </div>

                <div className="space-y-2">
                    <label htmlFor="method" className="text-sm font-medium text-foreground">
                        Payment Method <span className="text-red-500">*</span>
                    </label>
                    <select
                        id="method"
                        name="method"
                        required
                        value={method}
                        onChange={(e) => setMethod(e.target.value)}
                        className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-transparent"
                    >
                        <option value="Cash">Cash</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Credit Card">Credit Card</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <label htmlFor="accountId" className="text-sm font-medium text-foreground">
                        Payment Account <span className="text-red-500">*</span>
                    </label>
                    <select
                        name="accountId"
                        required
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                        className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-transparent"
                    >
                         <option value="" disabled>Select Account</option>
                         {displayAccounts.map((account) => (
                            <option key={account.id} value={account.id}>
                                {account.code ? `${account.code} - ` : ""}{account.name}
                            </option>
                         ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground flex items-center justify-between">
                        <span>Link to Invoices <span className="text-xs text-muted-foreground font-normal">(Optional)</span></span>
                        {selectedInvoices.length > 0 && (
                            <span className="text-xs font-medium text-minia-primary">{selectedInvoices.length} selected</span>
                        )}
                    </label>
                    
                    {fetchingInvoices ? (
                        <div className="text-sm text-muted-foreground flex items-center gap-2 py-2">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Loading invoices...
                        </div>
                    ) : unpaidInvoices.length > 0 ? (
                        <div className="border border-border rounded-md overflow-hidden max-h-60 overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 text-muted-foreground">
                                    <tr>
                                        <th className="px-3 py-2 text-left w-8">
                                            <input type="checkbox" className="rounded border-input bg-background" disabled />
                                        </th>
                                        <th className="px-3 py-2 text-left">Invoice #</th>
                                        <th className="px-3 py-2 text-right">Balance</th>
                                        <th className="px-3 py-2 text-right w-24">Payment</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {unpaidInvoices.map((inv) => {
                                        const isSelected = selectedInvoices.some(i => i.id === inv.id);
                                        const allocatedAmount = selectedInvoices.find(i => i.id === inv.id)?.amount || 0;
                                        
                                        return (
                                            <tr key={inv.id} className={isSelected ? "bg-primary/5" : ""}>
                                                <td className="px-3 py-2">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isSelected}
                                                        onChange={() => handleInvoiceToggle(inv.id, inv.balanceAmount)}
                                                        className="rounded border-input bg-background text-minia-primary accent-minia-primary focus:ring-minia-primary"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 text-foreground">
                                                    <div>{inv.invoiceNumber}</div>
                                                    <div className="text-xs text-muted-foreground">{new Date(inv.date).toLocaleDateString()}</div>
                                                </td>
                                                <td className="px-3 py-2 text-right text-muted-foreground">
                                                    {inv.currency} {inv.balanceAmount.toLocaleString()}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    {isSelected ? (
                                                        <input 
                                                            type="number" 
                                                            value={allocatedAmount}
                                                            onChange={(e) => handleInvoiceAmountChange(inv.id, parseFloat(e.target.value) || 0)}
                                                            className="w-full px-2 py-1 text-right text-xs border border-input bg-background text-foreground rounded focus:outline-none focus:border-minia-primary"
                                                            max={inv.balanceAmount}
                                                            step="0.01"
                                                        />
                                                    ) : (
                                                        <span className="text-muted">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-sm text-muted-foreground italic py-2">
                            {selectedPartyId ? "No unpaid invoices found." : "Select a party to view invoices."}
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <label htmlFor="reference" className="text-sm font-medium text-foreground">
                        Reference #
                    </label>
                    <input
                        type="text"
                        id="reference"
                        name="reference"
                        defaultValue={initialData?.reference || ""}
                        className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-transparent"
                        placeholder="e.g. Cheque No, Transaction ID"
                    />
                </div>
            </div>
        </div>

        <div className="mt-6 space-y-2">
            <label htmlFor="notes" className="text-sm font-medium text-foreground">
                Notes
            </label>
            <textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={initialData?.notes || ""}
                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-transparent"
                placeholder="Additional notes..."
            />
        </div>
      </div>
    </form>  );
}
