"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Banknote,
  CreditCard,
  Building2,
  Wallet,
  Check,
  Printer,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { toastActionError, toastAppErrorOrMessage, toastRaw as toast } from "@/components/providers/toast";
import NumericKeypad from "./numeric-keypad";
import Receipt, { type ReceiptData, type ReceiptPayment } from "./receipt";
import { posCheckoutClient } from "../_actions_client";
import type { CartLine } from "./cart";

export interface CheckoutLine {
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  amount: number;
}

type PMethod = "Cash" | "Bank Transfer" | "Cheque" | "Credit Card";

interface SplitRow {
  method: PMethod;
  amount: string;
  reference: string;
}

interface Customer {
  id: string;
  name: string;
}

interface POSProfileShape {
  id: string;
  defaultCashAccountId?: string;
  defaultBankAccountId?: string;
  walkinCustomer?: { id: string; name: string } | null;
  receiptHeader?: string | null;
  receiptFooter?: string | null;
  posCounter?: { name: string } | null;
}

interface ShiftShape {
  id: string;
  posProfileId: string;
  warehouseName?: string | null;
  counterName?: string | null;
  shiftNumber?: string | null;
}

interface CompanySettingsShape {
  quickAmountRounding?: number | null;
  defaultCurrencyNotes?: number[] | null;
  baseCurrency?: string;
}

interface CheckoutSheetProps {
  open: boolean;
  onClose: () => void;
  lines: CartLine[];
  subtotal: number;
  discountTotal: number;
  grandTotal: number;
  cartDiscount: number;
  customer: Customer;
  profile: POSProfileShape;
  shift: ShiftShape;
  companySettings: CompanySettingsShape;
  savedOrderId?: string | null;
  isCredit: boolean;
  onComplete: (options: { resetCart: boolean; invoiceNumber?: string }) => void;
}

const fmt = (n: number) => `Rs ${n.toFixed(2)}`;

function roundUp(n: number, step: number) {
  if (!step || step <= 0) return Math.ceil(n);
  return Math.ceil(n / step) * step;
}

const METHOD_ORDER: PMethod[] = ["Cash", "Bank Transfer", "Cheque", "Credit Card"];
const METHOD_META: Record<PMethod, { icon: any; label: string }> = {
  Cash: { icon: Banknote, label: "Cash" },
  "Bank Transfer": { icon: Building2, label: "Bank Transfer" },
  Cheque: { icon: CheckCircle2, label: "Cheque" },
  "Credit Card": { icon: CreditCard, label: "Credit Card" },
};

function methodToEngine(method: PMethod): "CASH" | "CARD" | "BANK" | "WALLET" {
  if (method === "Cash") return "CASH";
  if (method === "Credit Card") return "CARD";
  if (method === "Cheque") return "BANK";
  return "BANK";
}

export default function CheckoutSheet(props: CheckoutSheetProps) {
  const {
    open,
    onClose,
    lines,
    subtotal,
    discountTotal,
    grandTotal,
    cartDiscount,
    customer,
    profile,
    shift,
    companySettings,
    savedOrderId,
    isCredit,
    onComplete,
  } = props;

  const [mode, setMode] = useState<PMethod>("Cash");
  const [amountStr, setAmountStr] = useState<string>(grandTotal.toFixed(2));
  const [splitMode, setSplitMode] = useState(false);
  const [splits, setSplits] = useState<SplitRow[]>([
    { method: "Cash", amount: grandTotal.toFixed(2), reference: "" },
    { method: "Cash", amount: "", reference: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState<null | {
    invoiceNumber: string;
    receipt: ReceiptData;
  }>(null);
  const [needPrint, setNeedPrint] = useState(false);
  const [showCreditConfirm, setShowCreditConfirm] = useState(false);
  const [autoDismissRemaining, setAutoDismissRemaining] = useState<number>(5);

  const amountRef = useRef<HTMLInputElement | null>(null);
  const userEditedAmountRef = useRef<boolean>(false);
  const lastInitialRef = useRef<string>("");
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!open) {
      setCompleted(null);
      setNeedPrint(false);
      setShowCreditConfirm(false);
      setSubmitting(false);
      setSplitMode(false);
      setMode("Cash");
      setAmountStr(grandTotal.toFixed(2));
      lastInitialRef.current = grandTotal.toFixed(2);
      userEditedAmountRef.current = false;
      setSplits([
        { method: "Cash", amount: grandTotal.toFixed(2), reference: "" },
        { method: "Cash", amount: "", reference: "" },
      ]);
    } else if (isCredit) {
      setShowCreditConfirm(true);
    }
  }, [open, grandTotal, isCredit]);

  useEffect(() => {
    if (!open) return;
    if (lastInitialRef.current !== "" && Number(grandTotal.toFixed(2)) !== Number(lastInitialRef.current)) {
      if (!userEditedAmountRef.current) {
        setAmountStr(grandTotal.toFixed(2));
        lastInitialRef.current = grandTotal.toFixed(2);
      }
    }
  }, [grandTotal, open]);

  useEffect(() => {
    if (!open || isCredit || splitMode || submitting || completed) return;
    const applyFocus = () => {
      const el = amountRef.current;
      if (!el) return;
      el.focus({ preventScroll: false });
      if (!userEditedAmountRef.current) {
        try {
          el.setSelectionRange(0, el.value.length);
        } catch {
          el.select();
        }
      }
    };
    let raf2 = 0;
    let raf3 = 0;
    const raf = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        raf3 = requestAnimationFrame(applyFocus);
      });
    });
    const t1 = setTimeout(applyFocus, 200);
    const t2 = setTimeout(applyFocus, 400);
    return () => {
      cancelAnimationFrame(raf);
      if (raf2) cancelAnimationFrame(raf2);
      if (raf3) cancelAnimationFrame(raf3);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [open, isCredit, splitMode, grandTotal, submitting, completed]);

  useEffect(() => {
    if (!completed) return;
    setAutoDismissRemaining(5);
    const id = completed.invoiceNumber;
    const tick = setInterval(() => {
      setAutoDismissRemaining((r) => {
        if (r <= 1) {
          clearInterval(tick);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    const t = setTimeout(() => {
      clearInterval(tick);
      if (onCompleteRef.current) {
        onCompleteRef.current({ resetCart: true, invoiceNumber: id });
      }
    }, 5000);
    return () => {
      clearInterval(tick);
      clearTimeout(t);
    };
  }, [completed]);

  const quickAmounts = useMemo(() => {
    const rounding = companySettings.quickAmountRounding || 10;
    const notes = Array.isArray(companySettings.defaultCurrencyNotes)
      ? companySettings.defaultCurrencyNotes.filter((n) => typeof n === "number" && n > 0)
      : [];
    const fromRounding: number[] = [];
    const base = roundUp(grandTotal, rounding);
    for (const mult of [1, 2, 3, 5]) {
      const v = Math.round(base * mult);
      if (v >= grandTotal - 0.001) fromRounding.push(v);
    }
    const fromNotes = notes.filter((n) => n >= grandTotal - 0.001).sort((a, b) => a - b);
    const combined = Array.from(new Set([...fromRounding, ...fromNotes])).sort(
      (a, b) => a - b
    );
    return combined.slice(0, 6);
  }, [grandTotal, companySettings]);

  const receiptLines: CheckoutLine[] = lines.map((l) => {
    const amt = l.quantity * l.unitPrice - l.discount;
    return {
      description: l.itemName,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discount: l.discount,
      amount: amt,
    };
  });

  const totalPaid = splitMode
    ? splits.reduce((s, r) => s + (Number(r.amount) || 0), 0)
    : Number(amountStr) || 0;

  const change = !isCredit && totalPaid >= grandTotal ? totalPaid - grandTotal : 0;

  const tenderMode: any = splitMode
    ? "SPLIT"
    : isCredit
    ? "CREDIT"
    : methodToEngine(mode);

  const tenderSplits = splitMode
    ? splits
        .filter((r) => (Number(r.amount) || 0) > 0)
        .map((r) => ({
          method: methodToEngine(r.method),
          amount: Number(r.amount),
          reference: r.reference || undefined,
        }))
    : undefined;

  function recomputeSplits(rows: SplitRow[], editedIdx: number): SplitRow[] {
    const numeric = rows.map((r) => Number(r.amount) || 0);
    const keepRows = rows.map((r) => ({ ...r }));

    const totalBefore = numeric.slice(0, editedIdx).reduce((s, n) => s + n, 0);
    const editedAmt = numeric[editedIdx] || 0;
    const remaining = Math.max(0, grandTotal - totalBefore - editedAmt);

    const base = keepRows.slice(0, editedIdx + 1);
    const hasAnyAmount = editedAmt > 0 || totalBefore > 0 || remaining > 0.001;

    if (hasAnyAmount) {
      if (remaining > 0.001) {
        base.push({ method: "Cash", amount: remaining.toFixed(2), reference: "" });
      }
      base.push({ method: "Cash", amount: "", reference: "" });
      while (
        base.length > 2 &&
        Number(base[base.length - 1].amount) === 0 &&
        Number(base[base.length - 2].amount) === 0
      ) {
        base.pop();
      }
      while (base.length < 2) {
        base.push({ method: "Cash", amount: "", reference: "" });
      }
      return base;
    }

    return base.slice(0, editedIdx + 1).concat([
      { method: "Cash", amount: "", reference: "" },
      { method: "Cash", amount: "", reference: "" },
    ]).slice(0, 2);
  }

  function updateSplit(idx: number, patch: Partial<SplitRow>) {
    setSplits((prev) => {
      const next = prev.map((row, i) =>
        i === idx ? { ...row, ...patch } : row
      );
      if (patch.amount !== undefined) {
        return recomputeSplits(next, idx);
      }
      return next;
    });
  }

  function appendKeypadKey(key: string) {
    if (splitMode || isCredit) return;
    const el = amountRef.current;
    if (el && document.activeElement !== el) {
      el.focus({ preventScroll: false });
    }
    let replaceAll = false;
    if (el && !userEditedAmountRef.current) {
      try {
        const s = el.selectionStart;
        const e = el.selectionEnd;
        replaceAll =
          s === 0 &&
          e != null &&
          e >= (el.value || "").length &&
          (el.value || "").length > 0;
      } catch {}
    }
    userEditedAmountRef.current = true;
    setAmountStr((prev) => {
      const base = replaceAll ? "" : prev;
      if (key === "00") {
        if (base === "0") return "0";
        return base ? base + "00" : "0";
      }
      if (key === ".") {
        if (base.includes(".")) return base;
        return base === "" ? "0." : base + ".";
      }
      if (base === "0") return key;
      const next = base + key;
      if (next.split(".")[1]?.length > 2) return base;
      return next;
    });
  }

  function doBackspace() {
    if (splitMode || isCredit) return;
    userEditedAmountRef.current = true;
    setAmountStr((prev) => (prev.length <= 1 ? "0" : prev.slice(0, -1)));
  }

  function doClear() {
    if (splitMode || isCredit) return;
    userEditedAmountRef.current = true;
    setAmountStr("0");
    setTimeout(() => {
      const el = amountRef.current;
      if (el) {
        el.focus({ preventScroll: false });
        try {
          el.setSelectionRange(0, el.value.length);
        } catch {
          el.select();
        }
      }
    }, 0);
  }

  function doEnter() {}

  async function doSubmit(action: "NEW_ORDER" | "PRINT") {
    if (!isCredit && totalPaid + 0.0001 < grandTotal) {
      toast.error("Paid amount is less than grand total");
      return;
    }
    if (splitMode && tenderSplits && tenderSplits.length === 0) {
      toast.error("No split payments entered");
      return;
    }

    setSubmitting(true);
    try {
      const payloadLines = lines.map((l) => ({
        itemId: l.itemId,
        itemName: l.itemName,
        unitName: l.unitName,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount: l.discount,
        warehouseName: l.warehouseName || shift.warehouseName || "",
        batchNumber: (l as any).batchNumber || undefined,
        expiryDate: (l as any).expiryDate || null,
        itemBatchId: (l as any).itemBatchId || null,
      }));

      const result: any = await posCheckoutClient({
        posProfileId: profile.id,
        customerId: customer.id,
        lines: payloadLines,
        tender: {
          mode: tenderMode,
          cashAccountId: profile.defaultCashAccountId,
          bankAccountId: profile.defaultBankAccountId,
          splits: tenderSplits,
        },
        cartDiscount,
        savedOrderId: savedOrderId || undefined,
        isCredit,
        completeAction: action,
      });

      if (result?.ok === false || result?.error) {
        toastActionError(result, { fallback: "Checkout failed" });
        return;
      }

      const payload: any = (result?.ok && result?.data) ? result.data : result;
      const invNo = payload?.invoiceNumber || "POS-00001";
      const payments: ReceiptPayment[] = isCredit
        ? []
        : splitMode && tenderSplits
        ? tenderSplits.map((s) => ({
            method:
              s.method === "CASH"
                ? "Cash"
                : s.method === "CARD"
                ? "Credit Card"
                : s.method === "BANK"
                ? "Bank Transfer"
                : "Wallet",
            amount: s.amount,
            reference: s.reference,
          }))
        : [{ method: mode, amount: grandTotal }];

      const receiptData: ReceiptData = {
        invoiceNumber: invNo,
        receiptHeader: profile.receiptHeader,
        receiptFooter: profile.receiptFooter,
        counterName: shift.counterName || profile.posCounter?.name,
        cashierName: undefined,
        customerName: customer.name,
        date: new Date(),
        lines: receiptLines.map((l) => l),
        subTotal: subtotal,
        discountTotal,
        grandTotal,
        payments,
        change: change > 0 ? change : undefined,
        isCredit,
      };

      setCompleted({ invoiceNumber: invNo, receipt: receiptData });
      toast.success(`Invoice ${invNo} created`);

      if (action === "PRINT") {
        setNeedPrint(true);
      }
    } catch (err: any) {
      console.error(err);
      toastAppErrorOrMessage(err, "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  if (completed) {
    const progressPct = Math.max(0, Math.min(100, (1 - autoDismissRemaining / 5) * 100));
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="relative w-full max-w-2xl max-h-[92vh] overflow-hidden rounded-xl bg-background border border-border shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600">
                <Check className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Payment Complete
                </h2>
                <p className="text-xs text-muted-foreground">
                  Invoice {completed.invoiceNumber}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-full border border-border">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-minia-primary text-white text-[10px] font-bold">
                  {autoDismissRemaining}
                </span>
                New order in {autoDismissRemaining}s
              </div>
              <button
                onClick={() => {
                  setCompleted(null);
                  onComplete({
                    resetCart: true,
                    invoiceNumber: completed.invoiceNumber,
                  });
                }}
                className="rounded-md p-2 text-muted-foreground hover:bg-accent transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="h-1 w-full bg-muted overflow-hidden">
            <div
              className="h-full bg-minia-primary transition-[width] duration-1000 ease-linear"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex-1 overflow-y-auto bg-muted/30 p-4">
            <div className="max-w-[90mm] mx-auto rounded-lg border shadow bg-white">
              <Receipt
                data={completed.receipt}
                print={needPrint}
                onAfterPrint={() => setNeedPrint(false)}
              />
            </div>
          </div>
          <div className="flex gap-3 border-t px-6 py-4 bg-background">
            <button
              onClick={() =>
                onComplete({
                  resetCart: true,
                  invoiceNumber: completed.invoiceNumber,
                })
              }
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-minia-primary px-4 py-3 text-white font-semibold hover:brightness-95 disabled:opacity-50 transition-colors"
            >
              <Check className="h-5 w-5" />
              New Order
            </button>
            <button
              onClick={() => setNeedPrint(true)}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-3 font-semibold text-foreground hover:bg-accent disabled:opacity-50 transition-colors"
            >
              <Printer className="h-5 w-5" />
              Print Receipt
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:w-[95vw] md:w-[90vw] lg:w-[82vw] xl:w-[72vw] 2xl:w-[62vw] max-w-6xl h-full bg-background shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
        <div className="flex items-center justify-between border-b px-4 sm:px-6 py-3 sm:py-4 shrink-0">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-foreground">
              {isCredit ? "Credit Checkout" : "Payment Checkout"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {customer.name} &middot; {lines.length} item{lines.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {showCreditConfirm && isCredit && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
            <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-2xl p-6 space-y-4 animate-in zoom-in-95">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Confirm Credit Sale</h3>
                  <p className="text-xs text-muted-foreground">
                    Invoice will be marked as sent with balance due.
                  </p>
                </div>
              </div>
              <div className="rounded-lg bg-amber-500/10 border border-amber-200/50 p-4 text-sm">
                <div className="text-amber-800">
                  Sell <span className="font-bold">{fmt(grandTotal)}</span> on credit to{" "}
                  <span className="font-bold">{customer.name}</span>?
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => {
                    setShowCreditConfirm(false);
                    onClose();
                  }}
                  className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowCreditConfirm(false)}
                  className="flex-1 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
                >
                  Yes, Continue
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          <div className="w-full md:w-[32%] lg:w-[30%] min-w-0 md:min-w-[260px] md:max-w-[340px] border-b md:border-b-0 md:border-r flex flex-col bg-muted/10 shrink-0">
            <div className="px-4 sm:px-5 py-3 border-b bg-background shrink-0">
              <h3 className="text-sm font-semibold text-foreground">Order Summary</h3>
            </div>
            <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-2 min-h-0">
              {lines.map((l, i) => {
                const amt = l.quantity * l.unitPrice - l.discount;
                return (
                  <div
                    key={l.uid || i}
                    className="rounded-lg border border-border bg-background p-2.5 sm:p-3 text-xs sm:text-sm"
                  >
                    <div className="flex justify-between gap-2">
                      <div className="font-medium text-foreground truncate">{l.itemName}</div>
                      <div className="font-semibold text-foreground whitespace-nowrap">
                        {fmt(amt)}
                      </div>
                    </div>
                    <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                      {l.quantity} x {fmt(l.unitPrice)}
                      {l.discount ? ` · Disc ${fmt(l.discount)}` : ""}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-t bg-background p-3 sm:p-4 space-y-1.5 sm:space-y-2 text-xs sm:text-sm shrink-0">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{fmt(subtotal)}</span>
              </div>
              {discountTotal > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Discount</span>
                  <span className="font-medium">-{fmt(discountTotal)}</span>
                </div>
              )}
              <div className="h-px bg-border/60 my-1 sm:my-2"></div>
              <div className="flex justify-between text-base sm:text-lg">
                <span className="font-bold text-foreground">Grand Total</span>
                <span className="font-extrabold text-minia-primary">{fmt(grandTotal)}</span>
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b shrink-0">
              <div className="flex items-end justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    {isCredit
                      ? "Credit Sale"
                      : splitMode
                      ? "Split Payment"
                      : "Amount Tendered"}
                  </div>
                  {!isCredit ? (
                    <input
                      ref={amountRef}
                      type="text"
                      value={splitMode ? "" : amountStr}
                      onChange={(e) => {
                        userEditedAmountRef.current = true;
                        setAmountStr(e.target.value);
                      }}
                      onFocus={(e) => {
                        if (!userEditedAmountRef.current) {
                          try {
                            e.currentTarget.setSelectionRange(0, e.currentTarget.value.length);
                          } catch {
                            e.currentTarget.select();
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") doEnter();
                      }}
                      className="w-full text-3xl sm:text-4xl font-extrabold text-foreground bg-transparent border-0 border-b-2 border-minia-primary/40 focus:border-minia-primary focus:outline-none focus:ring-0 p-0 pb-1"
                      disabled={splitMode || submitting}
                    />
                  ) : (
                    <div className="text-3xl sm:text-4xl font-extrabold text-amber-600">
                      {fmt(grandTotal)}
                    </div>
                  )}
                </div>
                {!isCredit && change > 0 && (
                  <div className="text-right shrink-0">
                    <div className="text-xs text-muted-foreground">Change</div>
                    <div className="text-xl sm:text-2xl font-bold text-emerald-600">{fmt(change)}</div>
                  </div>
                )}
              </div>
            </div>

            {!isCredit && !splitMode && (
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
                <div className="h-full flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5 sm:gap-6">
                  {/* Left Column: Payment Method + Quick Amounts */}
                  <div className="w-full lg:w-[45%] shrink-0 space-y-3.5 sm:space-y-4">
                    <div className="space-y-1.5 sm:space-y-2">
                      <label className="text-xs text-muted-foreground font-medium block">
                        Payment Method
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {METHOD_ORDER.map((m) => {
                          const Meta = METHOD_META[m];
                          const Icon = Meta.icon;
                          const active = mode === m;
                          return (
                            <button
                              key={m}
                              onClick={() => setMode(m)}
                              disabled={submitting}
                              className={`inline-flex items-center gap-2 px-3 py-2 sm:py-2.5 rounded-lg border text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 ${
                                active
                                  ? "bg-minia-primary border-minia-primary text-white"
                                  : "bg-background border-border text-foreground hover:border-minia-primary/40 hover:bg-accent/40"
                              }`}
                            >
                              <Icon className="h-4 w-4 shrink-0" />
                              <span className="truncate">{Meta.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {quickAmounts.length > 0 && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1.5 sm:mb-2 font-medium">
                          Quick Amounts
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                          {quickAmounts.map((v, i) => (
                            <button
                              key={`${v}-${i}`}
                              onClick={() => {
                                setAmountStr(v.toFixed(2));
                                setTimeout(() => {
                                  const el = amountRef.current;
                                  if (el) {
                                    el.focus({ preventScroll: false });
                                    try {
                                      el.setSelectionRange(0, el.value.length);
                                    } catch {
                                      el.select();
                                    }
                                  }
                                }, 0);
                              }}
                              disabled={submitting}
                              className="rounded-lg border border-border bg-background px-2 sm:px-3 py-1.5 sm:py-2 font-semibold text-xs sm:text-sm hover:border-minia-primary/50 hover:bg-minia-primary/5 text-foreground disabled:opacity-50 transition-colors truncate"
                            >
                              {fmt(v)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSplitMode(true);
                          setSplits([
                            { method: "Cash", amount: grandTotal.toFixed(2), reference: "" },
                            { method: "Cash", amount: "", reference: "" },
                          ]);
                        }}
                        className="text-xs text-minia-primary hover:underline font-medium inline-flex items-center gap-1"
                      >
                        + Add Split Payment
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Digital Numbers Keypad */}
                  <div className="w-full lg:w-[52%] flex-1 flex flex-col justify-center max-w-md mx-auto lg:max-w-none">
                    <div className="w-full">
                      <NumericKeypad
                        onKey={appendKeypadKey}
                        onBackspace={doBackspace}
                        onClear={doClear}
                        onEnter={doEnter}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!isCredit && splitMode && (
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-foreground">
                    Split Payments
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSplitMode(false);
                      setSplits([
                        { method: "Cash", amount: grandTotal.toFixed(2), reference: "" },
                        { method: "Cash", amount: "", reference: "" },
                      ]);
                    }}
                    className="text-xs text-minia-primary hover:underline font-medium"
                  >
                    Back to single tender
                  </button>
                </div>
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-muted-foreground text-xs">
                      <tr>
                        <th className="text-left font-medium px-3 py-2">Method</th>
                        <th className="text-right font-medium px-3 py-2">Amount</th>
                        <th className="text-left font-medium px-3 py-2 hidden md:table-cell">Ref</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {splits.map((r, idx) => (
                        <tr key={idx} className="border-t border-border/60">
                          <td className="px-3 py-2">
                            <select
                              value={r.method}
                              onChange={(e) =>
                                updateSplit(idx, {
                                  method: e.target.value as PMethod,
                                })
                              }
                              disabled={submitting}
                              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-minia-primary/40"
                            >
                              {METHOD_ORDER.map((m) => (
                                <option key={m} value={m}>
                                  {m}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={r.amount}
                              onChange={(e) =>
                                updateSplit(idx, { amount: e.target.value })
                              }
                              disabled={submitting}
                              placeholder="0.00"
                              className="w-full text-right rounded-md border border-input bg-background px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-minia-primary/40"
                            />
                          </td>
                          <td className="px-3 py-2 hidden md:table-cell">
                            <input
                              type="text"
                              value={r.reference}
                              onChange={(e) =>
                                updateSplit(idx, { reference: e.target.value })
                              }
                              disabled={submitting}
                              placeholder="optional"
                              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-minia-primary/40"
                            />
                          </td>
                          <td className="px-2 py-2 w-10">
                            {splits.length > 2 && idx < splits.length - 1 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setSplits((prev) => {
                                    const filtered = prev.filter((_, i) => i !== idx);
                                    return recomputeSplits(filtered, Math.max(0, idx - 1));
                                  })
                                }
                                disabled={submitting}
                                className="text-muted-foreground hover:text-red-600 p-1 rounded hover:bg-red-500/10 transition-colors"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm space-y-1.5">
                  <div className="flex justify-between font-semibold text-foreground">
                    <span>Grand Total</span>
                    <span>{fmt(grandTotal)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Paid So Far</span>
                    <span>{fmt(totalPaid)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-foreground pt-1 border-t border-border/60">
                    <span>Remaining</span>
                    <span
                      className={
                        totalPaid + 0.0001 >= grandTotal
                          ? "text-emerald-700"
                          : "text-amber-700"
                      }
                    >
                      {fmt(Math.max(0, grandTotal - totalPaid))}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {isCredit && (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="max-w-md w-full rounded-xl border-2 border-amber-200 bg-amber-50 p-6 text-center space-y-3">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
                    <CreditCard className="h-7 w-7" />
                  </div>
                  <h3 className="text-lg font-semibold text-amber-900">
                    Credit Sale Confirmation
                  </h3>
                  <p className="text-sm text-amber-800">
                    This invoice will be marked as <b>SENT</b> with a balance of{" "}
                    <b>{fmt(grandTotal)}</b> due from <b>{customer.name}</b>.
                  </p>
                </div>
              </div>
            )}

            <div className="border-t bg-background px-4 sm:px-6 py-3 sm:py-4 shrink-0">
              <div className="flex gap-3">
                <button
                  onClick={() => doSubmit("NEW_ORDER")}
                  disabled={submitting || showCreditConfirm}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-minia-primary px-3 sm:px-4 py-3 sm:py-3.5 text-white font-semibold text-sm sm:text-base hover:brightness-95 disabled:opacity-50 shadow-sm transition-all active:scale-[0.99]"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                  Complete &amp; New Order
                </button>
                <button
                  onClick={() => doSubmit("PRINT")}
                  disabled={submitting || showCreditConfirm}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 sm:px-4 py-3 sm:py-3.5 font-semibold text-sm sm:text-base text-foreground hover:bg-accent disabled:opacity-50 transition-colors"
                >
                  <Printer className="h-4 w-4 sm:h-5 sm:w-5" />
                  Complete &amp; Print
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
