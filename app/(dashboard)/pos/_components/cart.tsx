"use client";

import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Minus,
  Trash2,
  Save,
  CreditCard,
  Banknote,
  Users,
  X as XIcon,
  Receipt as ReceiptIcon,
  Percent,
  CircleDollarSign,
  Search,
  UserPlus,
} from "lucide-react";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { listCustomersClient, createQuickCustomerClient } from "../_actions_client";
import { toast } from "react-hot-toast";

export interface CartLine {
  uid: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  unitName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  warehouseName: string | null;
  batchNumber?: string | null;
  expiryDate?: string | null;
  itemBatchId?: string | null;
  needsBatchPick?: boolean;
  needsExpiryPick?: boolean;
}

interface Customer {
  id: string;
  name: string;
}

type CartDiscountType = "AMOUNT" | "PERCENT";

interface CartProps {
  lines: CartLine[];
  onUpdateQty: (uid: string, qty: number) => void;
  onRemove: (uid: string, discount: number) => void;
  onDiscountLine: (uid: string, discount: number) => void;
  onPickBatchForLine?: (uid: string) => void;
  cartDiscount: number;
  cartDiscountInputValue: number;
  cartDiscountType: CartDiscountType;
  onCartDiscountChange: (val: number, type?: CartDiscountType) => void;
  subtotal: number;
  discountTotal: number;
  grandTotal: number;
  customer: Customer;
  walkinCustomerId: string;
  onChangeCustomer: (c: Customer) => void;
  onSaveOrder: () => void;
  onCheckout: () => void;
  onCreditCheckout: () => void;
  onClearCart: () => void;
}

const fmt = (n: number) => `Rs ${n.toFixed(2)}`;

export default function Cart({
  lines,
  onUpdateQty,
  onRemove,
  onDiscountLine,
  onPickBatchForLine,
  cartDiscount,
  cartDiscountInputValue,
  cartDiscountType,
  onCartDiscountChange,
  subtotal,
  discountTotal,
  grandTotal,
  customer,
  walkinCustomerId,
  onChangeCustomer,
  onSaveOrder,
  onCheckout,
  onCreditCheckout,
  onClearCart,
}: CartProps) {
  const [showCustomerSelect, setShowCustomerSelect] = useState(false);
  const [cartDiscountInput, setCartDiscountInput] = useState<string>(
    cartDiscountInputValue > 0 ? cartDiscountInputValue.toString() : ""
  );
  const [clearConfirm, setClearConfirm] = useState(false);
  const [saveConfirm, setSaveConfirm] = useState(false);

  const [customerSearch, setCustomerSearch] = useState("");
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  const customerSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!showCustomerSelect) return;
    let active = true;
    setCustomersLoading(true);
    listCustomersClient("")
      .then((data: any) => {
        if (!active) return;
        setCustomersList(Array.isArray(data) ? data : []);
      })
      .catch(() => active && setCustomersList([]))
      .finally(() => active && setCustomersLoading(false));
    return () => {
      active = false;
    };
  }, [showCustomerSelect]);

  useEffect(() => {
    if (!showCustomerSelect) return;
    if (customerSearchTimer.current) clearTimeout(customerSearchTimer.current);
    customerSearchTimer.current = setTimeout(async () => {
      setCustomersLoading(true);
      try {
        const data: any = await listCustomersClient(customerSearch);
        setCustomersList(Array.isArray(data) ? data : []);
      } catch {
        setCustomersList([]);
      } finally {
        setCustomersLoading(false);
      }
    }, 250);
    return () => {
      if (customerSearchTimer.current) clearTimeout(customerSearchTimer.current);
    };
  }, [customerSearch, showCustomerSelect]);

  async function handleCreateCustomer() {
    const name = newCustomerName.trim();
    if (!name) {
      toast.error("Customer name is required");
      return;
    }
    setCreatingCustomer(true);
    try {
      const res: any = await createQuickCustomerClient(name);
      if (res && res.error) {
        toast.error(res.error);
        return;
      }
      if (res && res.customer) {
        onChangeCustomer({ id: res.customer.id, name: res.customer.name });
        setShowNewCustomer(false);
        setNewCustomerName("");
        setShowCustomerSelect(false);
        toast.success("Customer created and selected");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to create customer");
    } finally {
      setCreatingCustomer(false);
    }
  }

  function handlePickCustomer(c: Customer) {
    onChangeCustomer(c);
    setShowCustomerSelect(false);
  }

  function handleResetToWalkin() {
    onChangeCustomer({ id: walkinCustomerId, name: customer.name });
  }

  const lineAmount = (l: CartLine) => l.quantity * l.unitPrice - l.discount;

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ReceiptIcon className="h-5 w-5 text-minia-primary" />
          <h2 className="font-semibold text-foreground">Current Sale</h2>
          {lines.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-minia-primary/15 text-minia-primary font-medium">
              {lines.length} items
            </span>
          )}
        </div>
      </div>

      <div className="px-4 py-3 border-b border-border bg-muted/20">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600">
              <Users className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Customer</div>
              <div className="font-medium text-sm text-foreground truncate">{customer.name}</div>
            </div>
          </div>
          <button
            onClick={() => setShowCustomerSelect(!showCustomerSelect)}
            className="text-xs px-2.5 py-1.5 rounded-md border border-border hover:bg-accent/60 font-medium text-foreground transition-colors"
          >
            Change
          </button>
        </div>

        {showCustomerSelect && (
          <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted-foreground font-medium">Select Customer</label>
              <button
                onClick={() => setShowCustomerSelect(false)}
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-accent/60"
              >
                Close
              </button>
            </div>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                autoFocus
                placeholder="Search by name..."
                className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-minia-primary/40"
              />
            </div>
            <button
              onClick={() => {
                onChangeCustomer({ id: walkinCustomerId, name: "Walk-in Customer" });
                setShowCustomerSelect(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md border text-sm transition-colors ${
                customer.id === walkinCustomerId
                  ? "bg-minia-primary/10 border-minia-primary/40 text-minia-primary"
                  : "border-border hover:bg-accent/50 text-foreground"
              }`}
            >
              <span className="font-medium">🚶 Walk-in Customer</span>
              <span className="text-xs text-muted-foreground">Default</span>
            </button>
            <div className="max-h-52 overflow-y-auto rounded-md border border-border divide-y divide-border/60">
              {customersLoading ? (
                <div className="py-6 text-center text-xs text-muted-foreground">Loading customers...</div>
              ) : customersList.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground px-4">
                  No customers found. Create one below.
                </div>
              ) : (
                customersList.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handlePickCustomer(c)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                      customer.id === c.id
                        ? "bg-minia-primary/10 text-minia-primary"
                        : "hover:bg-accent/40 text-foreground"
                    }`}
                  >
                    <span className="truncate font-medium">{c.name}</span>
                    {customer.id === c.id && (
                      <span className="text-[10px] uppercase tracking-wide ml-2">Selected</span>
                    )}
                  </button>
                ))
              )}
            </div>
            {!showNewCustomer ? (
              <button
                onClick={() => {
                  setShowNewCustomer(true);
                  setNewCustomerName("");
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-dashed border-border hover:border-minia-primary/40 hover:bg-minia-primary/5 text-sm text-foreground transition-colors"
              >
                <UserPlus className="h-4 w-4 text-minia-primary" />
                Create New Customer
              </button>
            ) : (
              <div className="rounded-md border border-border p-3 space-y-2 bg-muted/20">
                <label className="text-xs text-muted-foreground font-medium">New Customer Name</label>
                <input
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  autoFocus
                  placeholder="Enter customer name..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-minia-primary/40"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateCustomer();
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowNewCustomer(false);
                      setNewCustomerName("");
                    }}
                    className="flex-1 px-3 py-2 rounded-md border border-border hover:bg-accent/60 text-sm font-medium text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateCustomer}
                    disabled={creatingCustomer || !newCustomerName.trim()}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-minia-primary text-white text-sm font-semibold hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {creatingCustomer ? "Creating..." : "Create & Select"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
        {lines.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/40 text-muted-foreground mb-4">
              <ReceiptIcon className="h-8 w-8" />
            </div>
            <p className="font-medium text-foreground">Cart is empty</p>
            <p className="text-sm text-muted-foreground mt-1">
              Click items on the left to add them
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background/95 backdrop-blur z-10 border-b border-border">
              <tr className="text-xs text-muted-foreground">
                <th className="text-left px-2.5 sm:px-3 py-2 font-medium">Item</th>
                <th className="text-center px-1 py-2 font-medium w-[88px] sm:w-[96px]">Qty</th>
                <th className="text-right px-1.5 py-2 font-medium hidden sm:table-cell w-[70px]">Price</th>
                <th className="text-right px-1.5 py-2 font-medium hidden xl:table-cell w-[60px]">Disc</th>
                <th className="text-right px-2.5 py-2 font-medium w-[80px] sm:w-[85px]">Amount</th>
                <th className="px-1 py-2 w-[32px] sm:w-[36px]"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.uid} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="px-2.5 sm:px-3 py-2 align-top">
                    <div className="font-medium text-foreground text-[13px] leading-tight line-clamp-2">
                      {l.itemName}
                    </div>
                    {(l.batchNumber || l.expiryDate || l.needsBatchPick || l.needsExpiryPick) && (
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {l.batchNumber && (
                          <span className="inline-flex items-center rounded-md bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 px-1.5 py-0.5 text-[10px] font-medium">
                            Batch {l.batchNumber}
                          </span>
                        )}
                        {l.expiryDate && (
                          <span className="inline-flex items-center rounded-md bg-amber-500/10 text-amber-700 border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium">
                            Exp {String(l.expiryDate).slice(0, 10)}
                          </span>
                        )}
                        {(l.needsBatchPick || l.needsExpiryPick) && (
                          <button
                            onClick={() => onPickBatchForLine?.(l.uid)}
                            className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 text-rose-600 border border-rose-500/30 px-1.5 py-0.5 text-[10px] font-medium hover:bg-rose-500/20"
                          >
                            ⚠ Select batch
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-1 py-2 align-top">
                    <div className="inline-flex items-center border border-border rounded-md overflow-hidden bg-background">
                      <button
                        onClick={() => onUpdateQty(l.uid, l.quantity - 1)}
                        className="px-1.5 py-1 text-muted-foreground hover:bg-accent transition-colors"
                      >
                        <Minus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={l.quantity}
                        onChange={(e) => {
                          const v = Math.max(1, Number(e.target.value) || 1);
                          onUpdateQty(l.uid, v);
                        }}
                        className="w-7 sm:w-8 text-center text-xs sm:text-sm py-0.5 sm:py-1 border-x border-border focus:outline-none bg-transparent"
                      />
                      <button
                        onClick={() => onUpdateQty(l.uid, l.quantity + 1)}
                        className="px-1.5 py-1 text-muted-foreground hover:bg-accent transition-colors"
                      >
                        <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-1.5 py-2 text-right align-top hidden sm:table-cell text-xs sm:text-sm text-muted-foreground">
                    {fmt(l.unitPrice)}
                  </td>
                  <td className="px-1.5 py-2 align-top hidden xl:table-cell">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={l.discount > 0 ? l.discount : ""}
                      onChange={(e) =>
                        onDiscountLine(l.uid, Number(e.target.value) || 0)
                      }
                      placeholder="0"
                      className="w-full px-1.5 py-1 text-right text-xs rounded border border-border/60 focus:outline-none focus:ring-1 focus:ring-minia-primary/40"
                    />
                  </td>
                  <td className="px-2.5 py-2 text-right align-top font-semibold text-foreground text-xs sm:text-sm whitespace-nowrap">
                    {fmt(lineAmount(l))}
                  </td>
                  <td className="px-1 py-2 align-top text-right">
                    <button
                      onClick={() => onRemove(l.uid, l.discount || 0)}
                      className="p-1 rounded text-muted-foreground hover:text-red-600 hover:bg-red-500/10 transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="border-t border-border bg-muted/10 shrink-0">
        <div className="px-3 sm:px-4 py-2.5 sm:py-3 space-y-1.5 sm:space-y-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs sm:text-sm text-muted-foreground">Subtotal</span>
            <span className="font-medium text-foreground text-xs sm:text-sm">{fmt(subtotal)}</span>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs sm:text-sm text-muted-foreground shrink-0">Discount</span>
              <div className="inline-flex items-center rounded-md border border-border overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => {
                    const amt = cartDiscountType === "AMOUNT" ? cartDiscountInputValue : 0;
                    setCartDiscountInput(amt > 0 ? amt.toString() : "");
                    onCartDiscountChange(amt, "AMOUNT");
                  }}
                  className={`px-1.5 py-0.5 text-xs font-medium transition-colors inline-flex items-center gap-0.5 ${
                    cartDiscountType === "AMOUNT"
                      ? "bg-minia-primary text-white"
                      : "bg-background text-muted-foreground hover:bg-accent"
                  }`}
                  title="Amount"
                >
                  <CircleDollarSign className="h-3 w-3" />
                  Rs
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const pct =
                      cartDiscountType === "PERCENT" ? cartDiscountInputValue : 0;
                    setCartDiscountInput(pct > 0 ? pct.toString() : "");
                    onCartDiscountChange(pct, "PERCENT");
                  }}
                  className={`px-1.5 py-0.5 text-xs font-medium transition-colors inline-flex items-center gap-0.5 ${
                    cartDiscountType === "PERCENT"
                      ? "bg-minia-primary text-white"
                      : "bg-background text-muted-foreground hover:bg-accent"
                  }`}
                  title="Percentage"
                >
                  <Percent className="h-3 w-3" />
                  %
                </button>
              </div>
              <div className="relative inline-flex items-center">
                <span className="absolute left-1.5 text-xs text-muted-foreground">
                  {cartDiscountType === "AMOUNT" ? "Rs" : "%"}
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  max={cartDiscountType === "PERCENT" ? 100 : undefined}
                  value={cartDiscountInput}
                  onChange={(e) => {
                    setCartDiscountInput(e.target.value);
                    const v = Number(e.target.value) || 0;
                    const max = cartDiscountType === "PERCENT" ? 100 : subtotal;
                    onCartDiscountChange(Math.min(v, max));
                  }}
                  placeholder={cartDiscountType === "AMOUNT" ? "0" : "0%"}
                  className="w-16 sm:w-20 pl-6 pr-1.5 py-0.5 text-right text-xs rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-minia-primary/40"
                />
              </div>
              {cartDiscountType === "PERCENT" && cartDiscount > 0 && (
                <span className="text-[10px] sm:text-[11px] text-muted-foreground">
                  = {fmt(cartDiscount)}
                </span>
              )}
            </div>
            <span className="font-medium text-red-500 text-xs sm:text-sm shrink-0">-{fmt(discountTotal)}</span>
          </div>

          <div className="h-px bg-border/60 my-1 sm:my-2"></div>

          <div className="flex items-center justify-between gap-4">
            <span className="font-semibold text-foreground text-sm sm:text-base">Grand Total</span>
            <span className="text-lg sm:text-xl font-bold text-minia-primary">{fmt(grandTotal)}</span>
          </div>
        </div>

        <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-1 grid grid-cols-2 gap-2 sm:gap-3 shrink-0">
          <div className="flex flex-col gap-1.5 sm:gap-2">
            <button
              onClick={() => setClearConfirm(true)}
              disabled={lines.length === 0}
              className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-2 sm:py-2.5 rounded-lg border border-border bg-background text-xs sm:text-sm font-semibold text-muted-foreground hover:text-red-600 hover:border-red-200 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <XIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Clear Cart
            </button>

            <button
              onClick={() => setSaveConfirm(true)}
              disabled={lines.length === 0}
              className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-2 sm:py-2.5 rounded-lg border border-border bg-background text-xs sm:text-sm font-semibold hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Save Order
            </button>

            <button
              onClick={onCreditCheckout}
              disabled={lines.length === 0 || customer.id === walkinCustomerId}
              title={
                customer.id === walkinCustomerId
                  ? "Please select a registered customer (other than walk-in) to sell on credit"
                  : ""
              }
              className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-2 sm:py-2.5 rounded-lg border-2 border-amber-400 bg-amber-50 text-amber-800 text-xs sm:text-sm font-semibold hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Sell on Credit
            </button>
            {customer.id === walkinCustomerId && (
              <p className="text-[10px] text-amber-700/80 -mt-0.5 px-0.5 leading-tight">
                Select registered customer for credit
              </p>
            )}
          </div>

          <div className="flex flex-col">
            <button
              onClick={onCheckout}
              disabled={lines.length === 0}
              className="h-full min-h-[90px] inline-flex flex-col items-center justify-center gap-1 px-3 sm:px-4 py-3 rounded-lg bg-minia-primary text-white font-semibold hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all active:scale-[0.99]"
            >
              <div className="inline-flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base">
                <Banknote className="h-4 w-4 sm:h-5 sm:w-5" />
                Checkout
              </div>
              <div className="text-lg sm:text-xl font-bold truncate max-w-full px-1">{fmt(grandTotal)}</div>
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={clearConfirm}
        onClose={() => setClearConfirm(false)}
        onConfirm={() => {
          onClearCart();
        }}
        title="Clear Cart?"
        message="All items, discounts and any loaded hold order reference will be removed from the current sale. This cannot be undone."
        confirmText="Clear Cart"
        cancelText="Cancel"
        type="danger"
      />

      <ConfirmDialog
        isOpen={saveConfirm}
        onClose={() => setSaveConfirm(false)}
        onConfirm={() => {
          onSaveOrder();
        }}
        title="Save Order as Hold?"
        message={`This order will be saved for later and will continue counting toward your open ${
          lines.length === 1 ? "1 item" : `${lines.length} items`
        } hold (${fmt(grandTotal)}).`}
        confirmText="Save Order"
        cancelText="Cancel"
        type="warning"
      />
    </div>
  );
}
