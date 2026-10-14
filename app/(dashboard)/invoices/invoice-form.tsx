"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, ArrowLeft, Plus, Trash2, Calendar, FileText } from "lucide-react";
import Link from "next/link";
import { createInvoice } from "./actions";
import { getInvoicePriceListPrices } from "./pricing-actions";
import { toast } from "react-hot-toast";
import Select from "react-select";
import InventoryRowDetailsModal from "../inventory/inventory-row-details-modal";
import ConfirmDialog from "@/components/ui/confirm-dialog";

type Party = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  type: string;
  currency: string;
  sellingPriceListId?: string | null;
  buyingPriceListId?: string | null;
  creditLimit?: number | null;
  creditDays?: number | null;
  creditStatus?: string | null;
  currentExposure?: number | null;
};

type Currency = {
  id: string;
  code: string;
  name: string;
  symbol: string | null;
};

type SavedItem = {
  id: string;
  name: string;
  description?: string | null;
  defaultUnit?: string;
  itemType?: string;
  trackBatches?: boolean;
  hasExpiry?: boolean;
};

type MasterOption = {
  id: string;
  name: string;
};

type InvoiceItem = {
  id: string; // Temporary ID for React keys
  itemId: string;
  description: string;
  moreDetails?: string;
  batchNumber?: string;
  expiryDate?: string;
  warehouseName?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  amount: number;
};

interface InvoiceFormProps {
  parties: Party[];
  currencies: Currency[];
  initialData?: any; // To be typed properly later
  saleDefaultInvoiceNumber?: string;
  purchaseDefaultInvoiceNumber?: string;
  savedItems?: SavedItem[];
  savedBatches?: MasterOption[];
  savedWarehouses?: MasterOption[];
  companySettings?: any;
  standardSellingPriceListId: string;
  standardBuyingPriceListId: string;
  standardSellingPrices: Record<string, number>;
  standardBuyingPrices: Record<string, number>;
}

export default function InvoiceForm({
  parties,
  currencies,
  initialData,
  saleDefaultInvoiceNumber,
  purchaseDefaultInvoiceNumber,
  savedItems = [],
  savedBatches = [],
  savedWarehouses = [],
  companySettings,
  standardSellingPriceListId,
  standardBuyingPriceListId,
  standardSellingPrices,
  standardBuyingPrices,
}: InvoiceFormProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const submitActionRef = useRef<"save" | "send">("save");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailRowId, setDetailRowId] = useState<string | null>(null);
  const [submitAction, setSubmitAction] = useState<"save" | "send">("save");
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const menuPortalTarget = typeof window !== "undefined" ? document.body : undefined;
  
  // Base Currency
  const baseCurrency = companySettings?.baseCurrency || "USD";

  // Form State
  const [items, setItems] = useState<InvoiceItem[]>(() => {
    if (initialData?.items) {
        return initialData.items.map((item: any) => ({
            id: item.id,
            itemId: item.itemId || savedItems.find((savedItem) => savedItem.name === item.description)?.id || "",
            description: item.item?.name || item.description || "",
            moreDetails: item.moreDetails,
            batchNumber: item.batchNumber || "",
            expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().slice(0, 10) : "",
            warehouseName: item.warehouseName || "",
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            amount: item.amount
        }));
    }
    return [{ id: '1', itemId: "", description: '', moreDetails: '', batchNumber: '', expiryDate: '', warehouseName: '', quantity: 1, unitPrice: 0, discount: 0, amount: 0 }];
  });
  
  const [selectedPartyId, setSelectedPartyId] = useState(() => initialData?.partyId || "");
  const [selectedCurrency, setSelectedCurrency] = useState(() => initialData?.currency || baseCurrency);
  const [exchangeRate, setExchangeRate] = useState(() => initialData?.exchangeRate || 1.0);
  const [invoiceType, setInvoiceType] = useState(() => initialData?.type === "SALE" ? "SALES" : (initialData?.type || "SALES"));
  const [defaultWarehouseName, setDefaultWarehouseName] = useState<string>(() => {
    const warehouseNames: string[] = Array.from(
      new Set(
        (initialData?.items || [])
          .map((item: any) => String(item?.warehouseName || "").trim())
          .filter(Boolean),
      ),
    );

    return warehouseNames.length === 1 ? warehouseNames[0] : "";
  });
  const isEditing = !!initialData?.id;
  const currentStatus = String(initialData?.status || "DRAFT").toUpperCase();
  const isPurchaseInvoice = invoiceType === "PURCHASE";
  const canShowSaveAndSend = !isEditing || currentStatus === "DRAFT";
  const [priceListCache, setPriceListCache] = useState<Record<string, Record<string, number>>>(() => ({
    [standardSellingPriceListId]: standardSellingPrices,
    [standardBuyingPriceListId]: standardBuyingPrices,
  }));
  const formatAmount = (value: number) =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value || 0);
  
  // Computed Totals
  const subTotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const discountTotal = items.reduce((sum, item) => sum + item.discount, 0);
  const grandTotal = subTotal - discountTotal;

  // Filter parties based on invoice type
  const filteredParties = parties.filter((party) => {
    const type = (party.type || "CUSTOMER").toUpperCase();
    if (isPurchaseInvoice) {
      return type === "SUPPLIER" || type === "BOTH";
    }
    return type === "CUSTOMER" || type === "BOTH" || type === "PATIENT";
  });

  const selectedParty = filteredParties.find((party) => party.id === selectedPartyId) || parties.find((party) => party.id === selectedPartyId) || null;
  const detailRow = items.find((item) => item.id === detailRowId) || null;
  const detailRowItem = detailRow ? savedItems.find((savedItem) => savedItem.id === detailRow.itemId) || null : null;

  useEffect(() => {
    if (selectedPartyId) {
      // Only update currency if it hasn't been manually set or initialized
      // But wait, if user changes party, we PROBABLY want to update currency.
      // However, we must be careful not to overwrite if we are just loading.
      // Since we initialize selectedCurrency in useState, we can just check if it matches.
      
      const party = parties.find(p => p.id === selectedPartyId);
      if (party) {
        // Only set if current currency is base (default) OR if we are explicitly changing party
        // Actually, better logic: If initialData is present, we already set currency.
        // If user changes party, we want to update currency.
        // How to distinguish?
        // We can just set it. If it's same, no re-render.
        if (!initialData || selectedPartyId !== initialData.partyId) {
             setSelectedCurrency(party.currency);
        }
      }
    }
  }, [selectedPartyId, parties, initialData]);

  const handleAddItem = () => {
    setItems([
      ...items,
      { 
        id: Math.random().toString(36).substr(2, 9), 
        itemId: "",
        description: '', 
        moreDetails: '',
        batchNumber: '',
        expiryDate: '',
        warehouseName: defaultWarehouseName,
        quantity: 1, 
        unitPrice: 0, 
        discount: 0, 
        amount: 0 
      }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length === 1) return;
    setItems(items.filter(item => item.id !== id));
  };

  const handleItemChange = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        
        // Recalculate amount if relevant fields change
        if (field === 'quantity' || field === 'unitPrice' || field === 'discount') {
            const qty = field === 'quantity' ? Number(value) : item.quantity;
            const price = field === 'unitPrice' ? Number(value) : item.unitPrice;
            const disc = field === 'discount' ? Number(value) : item.discount;
            updatedItem.amount = (qty * price) - disc;
        }
        
        return updatedItem;
      }
      return item;
    }));
  };

  const handleDefaultWarehouseChange = (value: string) => {
    setDefaultWarehouseName(value);
    setItems((current) => current.map((item) => ({ ...item, warehouseName: value })));
  };

  const resolvePriceListId = () => {
    if (isPurchaseInvoice) {
      return selectedParty?.buyingPriceListId || standardBuyingPriceListId;
    }
    return selectedParty?.sellingPriceListId || standardSellingPriceListId;
  };

  const resolveUnitPrice = async (priceListId: string, itemId: string) => {
    const cached = priceListCache[priceListId];
    if (cached) {
      return cached[itemId] ?? 0;
    }

    try {
      const prices = await getInvoicePriceListPrices(priceListId);
      setPriceListCache((current) => ({ ...current, [priceListId]: prices }));
      return prices[itemId] ?? 0;
    } catch (error) {
      console.error(error);
      return 0;
    }
  };

  const handleItemSelect = async (id: string, selectedItemId: string) => {
    const selectedItem = savedItems.find((savedItem) => savedItem.id === selectedItemId) || null;
    const priceListId = resolvePriceListId();
    const unitPrice = selectedItemId ? await resolveUnitPrice(priceListId, selectedItemId) : 0;

    setItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;

        const nextQty = item.quantity;
        const nextDiscount = item.discount;
        const nextAmount = (Number(nextQty || 0) * Number(unitPrice || 0)) - Number(nextDiscount || 0);

        return {
          ...item,
          itemId: selectedItemId,
          description: selectedItem?.name || "",
          batchNumber: selectedItem?.itemType === "INVENTORY" ? "" : "",
          expiryDate: selectedItem?.itemType === "INVENTORY" ? "" : "",
          warehouseName: selectedItemId ? (item.warehouseName || defaultWarehouseName) : item.warehouseName,
          unitPrice,
          amount: nextAmount,
        };
      })
    );
  };

  // Initialize form data if editing
  // REMOVED: useEffect to reset state from initialData. 
  // We now use lazy initialization in useState.
  // This prevents state from being overwritten if parent re-renders.

  const displayInvoiceNumber = isEditing
    ? initialData?.invoiceNumber || ""
    : isPurchaseInvoice
      ? (purchaseDefaultInvoiceNumber || "PINV-1")
      : (saleDefaultInvoiceNumber || "INV-1");

  const handleSubmit = async (formData: FormData) => {
    const pendingSubmitAction = submitActionRef.current;

    if (items.some((item) => !item.itemId)) {
      const message = "Please select an item for every invoice row.";
      setError(message);
      toast.error(message);
      return;
    }

    setLoading(true);
    setError(null);

    // Add items to formData
    formData.set('itemsData', JSON.stringify(items));
    
    // Ensure currency is set
    formData.set('currency', selectedCurrency);
    formData.set('submitAction', pendingSubmitAction);

    try {
      let result;
      if (isEditing) {
        // Update existing invoice
        const { updateInvoice } = await import("./actions");
        result = await updateInvoice(initialData.id, formData);
      } else {
        // Create new invoice
        result = await createInvoice(formData);
      }

      if (result?.error) {
        setError(result.error);
        toast.error(result.error);
        setLoading(false);
      } else {
        toast.success(
          pendingSubmitAction === "send"
            ? (isEditing ? "Invoice saved and sent successfully!" : "Invoice created and sent successfully!")
            : (isEditing ? "Invoice updated successfully!" : "Invoice created successfully!")
        );
      }
    } catch (err) {
      toast.error("Something went wrong. Please try again.");
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <>
    <form ref={formRef} action={handleSubmit} className="space-y-6">
      <input type="hidden" name="submitAction" value={submitAction} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/invoices"
            className="p-2 hover:bg-accent rounded-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {isEditing ? (isPurchaseInvoice ? "Update Purchase Invoice" : "Update Sale Invoice") : (isPurchaseInvoice ? "New Purchase Invoice" : "New Sale Invoice")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEditing ? "Update Sale or Purchase Invoice" : "Create a new sale or purchase invoice"}
            </p>
          </div>
        </div>
        {!isEditing ? (
          <div className="hidden md:flex items-center rounded-lg border border-border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => {
                setInvoiceType("SALES");
                setSelectedPartyId("");
              }}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${invoiceType === "SALES" ? "bg-minia-primary text-white shadow-sm" : "text-foreground hover:bg-accent"}`}
            >
              Sale
            </button>
            <button
              type="button"
              onClick={() => {
                setInvoiceType("PURCHASE");
                setSelectedPartyId("");
              }}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${invoiceType === "PURCHASE" ? "bg-minia-primary text-white shadow-sm" : "text-foreground hover:bg-accent"}`}
            >
              Purchase
            </button>
          </div>
        ) : null}
        <div className="flex items-center gap-3">
          {canShowSaveAndSend ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => setShowSendConfirm(true)}
              className="inline-flex items-center justify-center px-4 py-2 border border-minia-primary text-minia-primary text-sm font-medium rounded-md hover:bg-minia-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && submitAction === "send" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Save & Sent"
              )}
            </button>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            onClick={() => {
              submitActionRef.current = "save";
              setSubmitAction("save");
            }}
            className="inline-flex items-center justify-center px-4 py-2 bg-minia-primary text-white text-sm font-medium rounded-md hover:brightness-95 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {submitAction === "send" ? "Sending..." : (isEditing ? "Updating..." : "Saving...")}
              </>
            ) : (
              isEditing
                ? (isPurchaseInvoice ? "Update Purchase" : "Update Sale")
                : (isPurchaseInvoice ? "Save Purchase" : "Save Sale")
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
          <div className="bg-card rounded-lg shadow-sm border border-border p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {!isEditing ? (
                  <div className="space-y-2 md:col-span-2 xl:col-span-3 md:hidden">
                    <label className="text-sm font-medium text-foreground">Invoice Type</label>
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-1">
                      <button
                        type="button"
                        onClick={() => {
                          setInvoiceType("SALES");
                          setSelectedPartyId("");
                        }}
                        className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${invoiceType === "SALES" ? "bg-minia-primary text-white shadow-sm" : "text-foreground hover:bg-accent"}`}
                      >
                        Sale
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setInvoiceType("PURCHASE");
                          setSelectedPartyId("");
                        }}
                        className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${invoiceType === "PURCHASE" ? "bg-minia-primary text-white shadow-sm" : "text-foreground hover:bg-accent"}`}
                      >
                        Purchase
                      </button>
                    </div>
                    <input type="hidden" name="type" value={invoiceType} />
                  </div>
                ) : (
                  <div className="space-y-2 md:col-span-2 xl:col-span-3">
                    <label htmlFor="type" className="text-sm font-medium text-foreground">
                      Invoice Type
                    </label>
                    <input
                      id="type"
                      aria-label="Invoice type"
                      value={isPurchaseInvoice ? "Purchase Invoice" : "Sales Invoice"}
                      readOnly
                      className="w-full px-3 py-2 border border-input bg-muted/50 text-muted-foreground rounded-md shadow-sm focus:outline-none"
                    />
                    <input type="hidden" name="type" value={invoiceType} />
                  </div>
                )}

                {/* Party Selection */}
                <div className="space-y-2">
                    <label htmlFor="partyId" className="text-sm font-medium text-foreground">
                        {isPurchaseInvoice ? "Supplier" : "Customer"} <span className="text-red-500">*</span>
                    </label>
                    <Select
                        id="partyId"
                        name="partyId"
                        required
                        options={filteredParties.map((party) => ({
                            value: party.id,
                            label: `${party.name}`
                        }))}
                        value={selectedPartyId ? {
                            value: selectedPartyId,
                            label: filteredParties.find(p => p.id === selectedPartyId) 
                                ? `${filteredParties.find(p => p.id === selectedPartyId)?.name}`
                                : ""
                        } : null}
                        onChange={(option) => setSelectedPartyId(option?.value || "")}
                        className="react-select-container"
                        classNamePrefix="react-select"
                        placeholder={isPurchaseInvoice ? "Select a supplier..." : "Select a customer..."}
                        isClearable
                    />
                    {/* Hidden input for form submission if needed, though we handle it in state */}
                    <input type="hidden" name="partyId" value={selectedPartyId} />
                    {!isPurchaseInvoice && selectedParty ? (
                      <div className={`rounded-md border px-3 py-2 text-xs ${selectedParty.creditStatus === "ON_HOLD" ? "border-red-200 bg-red-50 text-red-700" : "border-border bg-accent/30 text-muted-foreground"}`}>
                        <div>
                          Credit Limit: {selectedParty.creditLimit && selectedParty.creditLimit > 0 ? `${selectedParty.currency} ${Number(selectedParty.creditLimit).toLocaleString()}` : "Unlimited"}
                        </div>
                        <div>
                          Current Exposure: {selectedParty.currency} {Number(selectedParty.currentExposure || 0).toLocaleString()}
                        </div>
                        <div>
                          Status: {selectedParty.creditStatus || "ACTIVE"}{selectedParty.creditDays ? ` • ${selectedParty.creditDays} days` : ""}
                        </div>
                      </div>
                    ) : null}
                </div>

                {/* Invoice Number */}
                <div className="space-y-2">
                    <label htmlFor="invoiceNumber" className="text-sm font-medium text-foreground">
                        Invoice Number <span className="text-muted-foreground text-xs">(Auto-generated)</span>
                    </label>
                    <input
                        type="text"
                        id="invoiceNumber"
                        disabled
                        value={displayInvoiceNumber || "Auto-generated"}
                        className="w-full px-3 py-2 border border-input rounded-md shadow-sm bg-muted/50 text-muted-foreground cursor-not-allowed focus:outline-none"
                    />
                </div>

                {/* Date */}
                <div className="space-y-2">
                    <label htmlFor="date" className="text-sm font-medium text-foreground">
                        Invoice Date <span className="text-red-500">*</span>
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

                {/* Due Date */}
                <div className="space-y-2">
                    <label htmlFor="dueDate" className="text-sm font-medium text-foreground">
                        Due Date
                    </label>
                    <div className="relative">
                        <input
                            type="date"
                            id="dueDate"
                            name="dueDate"
                            defaultValue={initialData?.dueDate ? new Date(initialData.dueDate).toISOString().split('T')[0] : ''}
                            onClick={(e) => (e.target as HTMLInputElement).showPicker()}
                            className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-transparent"
                        />
                        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Default Warehouse</label>
                    <Select
                        value={defaultWarehouseName ? {
                            value: defaultWarehouseName,
                            label: defaultWarehouseName,
                        } : null}
                        onChange={(option) => handleDefaultWarehouseChange(option?.value || "")}
                        options={savedWarehouses.map((warehouse) => ({
                            value: warehouse.name,
                            label: warehouse.name,
                        }))}
                        className="react-select-container"
                        classNamePrefix="react-select"
                        placeholder="Apply to all items..."
                        isClearable
                        menuPortalTarget={menuPortalTarget}
                        menuPosition="fixed"
                        styles={{
                          menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                          menu: (base) => ({ ...base, zIndex: 9999 }),
                        }}
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="currency" className="text-sm font-medium text-foreground">
                        Currency
                    </label>
                    <Select
                        id="currency"
                        name="currency"
                        options={currencies.map((curr) => ({
                            value: curr.code,
                            label: `${curr.code} - ${curr.name}`
                        }))}
                        value={selectedCurrency ? {
                            value: selectedCurrency,
                            label: currencies.find(c => c.code === selectedCurrency)
                                ? `${selectedCurrency} - ${currencies.find(c => c.code === selectedCurrency)?.name}`
                                : selectedCurrency
                        } : null}
                        onChange={(option) => {
                            setSelectedCurrency(option?.value || "");
                            if ((option?.value || "") === baseCurrency) {
                                setExchangeRate(1.0);
                            }
                        }}
                        className="react-select-container"
                        classNamePrefix="react-select"
                        placeholder="Select currency..."
                    />
                    <input type="hidden" name="currency" value={selectedCurrency} />
                </div>

                {selectedCurrency !== baseCurrency && (
                    <div className="space-y-2">
                        <label htmlFor="exchangeRate" className="text-sm font-medium text-foreground">
                            Exchange Rate (1 {selectedCurrency} = ? {baseCurrency})
                        </label>
                        <input
                            type="number"
                            id="exchangeRate"
                            name="exchangeRate"
                            step="0.000001"
                            min="0"
                            required
                            value={exchangeRate}
                            onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-transparent"
                        />
                    </div>
                )}
            </div>
          </div>

          <div className="bg-card rounded-lg shadow-sm border border-border p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Invoice Summary</h3>

            <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                    <div className="text-muted-foreground">Subtotal</div>
                    <div className="text-right font-medium text-foreground">{selectedCurrency} {formatAmount(subTotal)}</div>
                </div>
                <div className="flex items-center justify-between gap-4">
                    <div className="text-muted-foreground">Discount</div>
                    <div className="text-right font-medium text-foreground">{selectedCurrency} {formatAmount(discountTotal)}</div>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
                    <div className="text-muted-foreground">Grand Total</div>
                    <div className="text-right text-base font-semibold text-foreground">{selectedCurrency} {formatAmount(grandTotal)}</div>
                </div>
                {selectedCurrency !== baseCurrency && (
                    <div className="flex items-start justify-between gap-4 text-xs">
                        <div className="text-muted-foreground">Base Total ({baseCurrency})</div>
                        <div className="text-right text-muted-foreground">{baseCurrency} {formatAmount(grandTotal * exchangeRate)}</div>
                    </div>
                )}
            </div>
          </div>
          </div>

          {/* Items Table */}
          <div className="bg-card rounded-lg shadow-sm border border-border p-6 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                    <thead>
                        <tr className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border">
                            <th className="pb-3 w-[40%]">Item</th>
                            <th className="pb-3 w-[12%]">Quantity</th>
                            <th className="pb-3 w-[16%]">Price</th>
                            <th className="pb-3 w-[12%]">Discount</th>
                            <th className="pb-3 w-[15%] text-right">Amount</th>
                            <th className="pb-3 w-[5%]"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {items.map((item) => (
                            <tr key={item.id} className="group">
                                <td className="py-3 pr-4 relative group/input">
                                    {(() => {
                                      const selectedItemMeta = savedItems.find((savedItem) => savedItem.id === item.itemId) || null;
                                      const showInventoryDetailsSummary = selectedItemMeta?.itemType === "INVENTORY";

                                      return (
                                        <>
                                    <Select
                                        value={item.itemId ? {
                                            value: item.itemId,
                                            label: savedItems.find((savedItem) => savedItem.id === item.itemId)?.name || item.description,
                                        } : null}
                                        onChange={(option) => handleItemSelect(item.id, option?.value || "")}
                                        options={savedItems.map((savedItem) => ({
                                            value: savedItem.id,
                                            label: savedItem.name,
                                        }))}
                                        className="react-select-container text-sm"
                                        classNamePrefix="react-select"
                                        placeholder="Select item..."
                                        isClearable
                                        menuPortalTarget={menuPortalTarget}
                                        menuPosition="fixed"
                                        styles={{
                                          menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                          menu: (base) => ({ ...base, zIndex: 9999 }),
                                        }}
                                    />
                                    <div className="mt-1 text-xs text-muted-foreground">
                                      {item.itemId
                                        ? (selectedItemMeta?.defaultUnit
                                            ? `Unit: ${selectedItemMeta?.defaultUnit}`
                                            : "")
                                        : ""}
                                    </div>
                                    {showInventoryDetailsSummary && (item.batchNumber || item.expiryDate) ? (
                                      <div className="mt-2 space-y-2">
                                        <div className="text-xs text-muted-foreground">
                                          {item.batchNumber ? `Batch: ${item.batchNumber}` : ""}
                                          {item.batchNumber && item.expiryDate ? " • " : ""}
                                          {item.expiryDate ? `Expiry: ${new Date(item.expiryDate).toLocaleDateString()}` : ""}
                                        </div>
                                      </div>
                                    ) : null}
                                        </>
                                      );
                                    })()}
                                </td>
                                <td className="py-3 pr-4">
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={item.quantity}
                                        onChange={(e) => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                        className="w-full px-2 py-1 text-sm border-0 border-b border-transparent focus:border-minia-primary focus:ring-0 bg-transparent text-foreground"
                                        required
                                    />
                                </td>
                                <td className="py-3 pr-4">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={item.unitPrice}
                                        onChange={(e) => handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                        className="w-full px-2 py-1 text-sm border-0 border-b border-transparent focus:border-minia-primary focus:ring-0 bg-transparent text-foreground"
                                        required
                                    />
                                </td>
                                <td className="py-3 pr-4">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={item.discount}
                                        onChange={(e) => handleItemChange(item.id, 'discount', parseFloat(e.target.value) || 0)}
                                        className="w-full px-2 py-1 text-sm border-0 border-b border-transparent focus:border-minia-primary focus:ring-0 bg-transparent text-foreground"
                                    />
                                </td>
                                <td className="py-3 text-right text-sm font-medium text-foreground">
                                    {formatAmount(item.amount)}
                                </td>
                                <td className="py-3 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                      {(() => {
                                        return (
                                          <button
                                              type="button"
                                              onClick={() => setDetailRowId(item.id)}
                                              className="text-muted-foreground hover:text-foreground"
                                          >
                                              <FileText className="h-4 w-4" />
                                          </button>
                                        );
                                      })()}
                                      <button
                                          type="button"
                                          onClick={() => handleRemoveItem(item.id)}
                                          className="text-muted-foreground hover:text-red-500"
                                      >
                                          <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <button
                type="button"
                onClick={handleAddItem}
                className="mt-4 flex items-center text-sm text-minia-primary hover:opacity-90 font-medium"
            >
                <Plus className="h-4 w-4 mr-1" />
                Add Line Item
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-card rounded-lg shadow-sm border border-border p-6">
              <label htmlFor="notes" className="text-sm font-medium text-foreground block mb-2">
                  Notes
              </label>
              <textarea
                  id="notes"
                  name="notes"
                  rows={4}
                  defaultValue={initialData?.notes || ''}
                  className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-transparent"
                  placeholder="Additional notes for the invoice..."
              />
            </div>

            <div className="bg-card rounded-lg shadow-sm border border-border p-6">
              <label htmlFor="terms" className="text-sm font-medium text-foreground block mb-2">
                  Terms & Conditions
              </label>
              <textarea
                  id="terms"
                  name="terms"
                  rows={4}
                  defaultValue={initialData?.terms || companySettings?.invoiceTerms || ''}
                  className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-minia-primary focus:border-transparent"
                  placeholder="Payment terms..."
              />
            </div>
          </div>
      </div>
    </form>

      <InventoryRowDetailsModal
        isOpen={!!detailRow}
        onClose={() => setDetailRowId(null)}
        title="Row Details"
        itemLabel={detailRowItem ? `${detailRowItem.name}${detailRowItem.defaultUnit ? ` (${detailRowItem.defaultUnit})` : ""}` : undefined}
        description={
          !detailRowItem
            ? "You can set warehouse now. Select an inventory item first if you also need batch and expiry."
            : detailRowItem.itemType !== "INVENTORY"
              ? "Warehouse can be set here. Batch and expiry apply only to inventory items."
              : "Warehouse can be set per row here. Batch and expiry are optional and can be added when needed."
        }
        warehouseOptions={savedWarehouses.map((warehouse) => ({
          value: warehouse.name,
          label: warehouse.name,
        }))}
        batchOptions={savedBatches.map((batch) => ({
          value: batch.name,
          label: batch.name,
        }))}
        warehouseName={detailRow?.warehouseName || ""}
        batchNumber={detailRow?.batchNumber || ""}
        expiryDate={detailRow?.expiryDate || ""}
        warehouseEnabled={true}
        batchEnabled={!!detailRowItem?.trackBatches}
        expiryEnabled={!!detailRowItem?.hasExpiry}
        onWarehouseChange={(value) => {
          if (detailRow) handleItemChange(detailRow.id, "warehouseName", value);
        }}
        onBatchChange={(value) => {
          if (detailRow) handleItemChange(detailRow.id, "batchNumber", value);
        }}
        onExpiryChange={(value) => {
          if (detailRow) handleItemChange(detailRow.id, "expiryDate", value);
        }}
      />

      <ConfirmDialog
        isOpen={showSendConfirm}
        onClose={() => setShowSendConfirm(false)}
        onConfirm={() => {
          submitActionRef.current = "send";
          setSubmitAction("send");
          setShowSendConfirm(false);
          formRef.current?.requestSubmit();
        }}
        title="Confirm Send"
        message={`This will save the invoice and mark it as Sent immediately. Do you want to continue with this ${isPurchaseInvoice ? "purchase" : "sale"} invoice?`}
        confirmText="Save & Sent"
        cancelText="Cancel"
        type="warning"
      />
    </>
  );
}
