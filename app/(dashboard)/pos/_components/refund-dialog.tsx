"use client";

import { useEffect, useMemo, useState } from "react";
import {
  X as XIcon,
  RotateCcw,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Receipt,
  Search as SearchIcon,
  ArrowLeft as ArrowLeftIcon,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { toastActionError } from "@/components/providers/toast";
import {
  posRefundClient,
  getInvoiceReceiptDuplicateClient,
  searchPOSInvoicesForRefundClient,
} from "../_actions_client";

export interface RefundTargetInvoice {
  id: string;
  invoiceNumber?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  date?: string | Date | null;
  status?: string | null;
  subTotal?: number | null;
  discountTotal?: number | null;
  grandTotal?: number | null;
  paidAmount?: number | null;
  balanceAmount?: number | null;
  items?: Array<{
    id?: string;
    itemId?: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    amount: number;
    batchNumber?: string | null;
    expiryDate?: string | Date | null;
    itemBatchId?: string | null;
    warehouseName?: string | null;
  }>;
  payments?: Array<{
    id?: string;
    method?: string | null;
    amount?: number | null;
    reference?: string | null;
  }>;
}

type Branch = "INVOICE_REVERSAL" | "STANDALONE_JE";
type Method = "CASH" | "CARD" | "BANK" | "WALLET";

interface RefundDialogProps {
  open: boolean;
  onClose: () => void;
  initialInvoice?: RefundTargetInvoice | null;
  walkinCustomerId: string;
  defaultCashAccountId?: string | null;
  defaultBankAccountId?: string | null;
}

const fmt = (n: number | null | undefined) =>
  `Rs ${(Number(n) || 0).toFixed(2)}`;

const r2 = (n: number | string | null | undefined) => {
  const v = Number(n || 0);
  return Math.round((v + Number.EPSILON) * 100) / 100;
};

const ymd = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export default function RefundDialog({
  open,
  onClose,
  initialInvoice,
  walkinCustomerId,
  defaultCashAccountId,
  defaultBankAccountId,
}: RefundDialogProps) {
  const [refundMethod, setRefundMethod] = useState<Method>("CASH");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [cartDiscount, setCartDiscount] = useState<number>(0);
  const [lines, setLines] = useState<
    Array<{
      itemId?: string | null;
      description: string;
      quantity: number;
      unitPrice: number;
      discount: number;
      amount: number;
      batchNumber?: string | null;
      expiryDate?: string | Date | null;
      warehouseName?: string | null;
      itemBatchId?: string | null;
    }>
  >([]);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{
    ok: boolean;
    refundId?: string;
    refundNumber?: string;
    grandTotal?: number;
    error?: string;
  } | null>(null);
  const [invoice, setInvoice] = useState<RefundTargetInvoice | null>(
    initialInvoice || null
  );
  const [standaloneMode, setStandaloneMode] = useState<boolean>(false);

  const branch: Branch = invoice ? "INVOICE_REVERSAL" : "STANDALONE_JE";
  const showLanding = !invoice && !standaloneMode;

  const [searchQuery, setSearchQuery] = useState("");
  const [searchFromDate, setSearchFromDate] = useState<string>("");
  const [searchToDate, setSearchToDate] = useState<string>("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchSearched, setSearchSearched] = useState(false);
  const [selectingInvoiceId, setSelectingInvoiceId] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!open) return;
    setLastResult(null);
    setSubmitting(false);
    setReason("");
    setNote("");
    setCartDiscount(0);
    setRefundMethod("CASH");
    setSearchQuery("");
    setSearchFromDate("");
    setSearchToDate("");
    setSelectingInvoiceId(null);
    if (initialInvoice) {
      setStandaloneMode(false);
      hydrateFromInvoice(initialInvoice);
    } else {
      setInvoice(null);
      setLines([]);
      setStandaloneMode(false);
      runSearch(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialInvoice?.id]);

  useEffect(() => {
    if (!open || initialInvoice || invoice || standaloneMode) return;
    const timer = setTimeout(() => {
      runSearch(false);
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, searchFromDate, searchToDate]);

  function hydrateFromInvoice(inv: RefundTargetInvoice) {
    setInvoice(inv);
    setStandaloneMode(false);
    const invItems = inv.items || [];
    setLines(
      invItems
        .filter((it: any) =>
          it.remainingQuantity != null
            ? Number(it.remainingQuantity) > 0.0001
            : Number(it.quantity || 0) > 0.0001
        )
        .map((it: any) => {
          const qty = Number(it.remainingQuantity ?? it.quantity ?? 1);
          const maxQ = Number(it.maxQuantity ?? it.remainingQuantity ?? qty);
          const origQ = Number(it.originalQuantity ?? it.quantity ?? qty);
          const uPrice = r2(it.unitPrice);
          const disc = r2(it.discount);
          return {
            itemId: it.itemId || null,
            description: it.description || "Refund line",
            quantity: qty,
            maxQuantity: maxQ,
            originalQuantity: origQ,
            unitPrice: uPrice,
            discount: disc,
            amount: r2(qty * uPrice - disc),
            batchNumber: it.batchNumber || null,
            expiryDate: it.expiryDate || null,
            warehouseName: it.warehouseName || null,
            itemBatchId: it.itemBatchId || null,
          };
        })
    );
  }

  async function runSearch(useDefaults = true) {
    setSearchLoading(true);
    try {
      const params: any = {
        query: searchQuery || undefined,
        limit: 50,
      };
      if (searchFromDate) params.fromDate = searchFromDate;
      else if (useDefaults) {
        const d = new Date();
        d.setDate(d.getDate() - 60);
        params.fromDate = ymd(d);
      }
      if (searchToDate) params.toDate = searchToDate;
      const res = (await searchPOSInvoicesForRefundClient(params)) as any[];
      setSearchResults(Array.isArray(res) ? res : []);
      setSearchSearched(true);
    } catch (err: any) {
      toast.error(err?.message || "Could not search invoices");
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  async function selectInvoiceForRefund(result: any) {
    if (!result?.id) return;
    setSelectingInvoiceId(result.id);
    try {
      const res: any = await getInvoiceReceiptDuplicateClient(result.id);
      if (res && res.ok && res.receipt) {
        const receiptLines = res.receipt.lines || [];
        const rawLines =
          receiptLines.length > 0
            ? receiptLines
            : result.refundableItems || [];
        const filteredLines = rawLines
          .filter((rl: any) =>
            rl.remainingQuantity != null
              ? Number(rl.remainingQuantity) > 0.0001
              : Number(rl.quantity || 0) > 0.0001
          )
          .map((rl: any, i: number) => {
            const qty = Number(rl.remainingQuantity ?? rl.quantity ?? 1);
            const origQ = Number(rl.originalQuantity ?? rl.quantity ?? qty);
            const uPrice = r2(rl.unitPrice);
            const disc = rl.discount ? r2(rl.discount) : 0;
            return {
              id: `${result.id}-line-${i}`,
              itemId: rl.itemId || null,
              description: rl.description,
              quantity: qty,
              maxQuantity: qty,
              originalQuantity: origQ,
              unitPrice: uPrice,
              discount: disc,
              amount: r2(qty * uPrice - disc),
              batchNumber: rl.batchNumber || null,
              expiryDate: rl.expiryDate || null,
              warehouseName: rl.warehouseName || null,
              itemBatchId: rl.itemBatchId || null,
            };
          });

        if (filteredLines.length === 0) {
          toast.error("All items on this invoice have already been refunded.");
          return;
        }

        const mapped: RefundTargetInvoice = {
          id: result.id,
          invoiceNumber: res.receipt.invoiceNumber || result.invoiceNumber,
          customerId: result.customerId || null,
          customerName:
            res.receipt.customerName ||
            result.customerName ||
            "Walk-in Customer",
          date: res.receipt.date || result.date,
          grandTotal: r2(
            res.receipt.remainingRefundableAmount ??
              result.remainingRefundableAmount ??
              res.receipt.grandTotal ??
              result.grandTotal
          ),
          subTotal: r2(res.receipt.subTotal ?? result.subTotal),
          discountTotal: r2(res.receipt.discountTotal ?? 0),
          status: result.status || null,
          items: filteredLines,
          payments: (result.payments || res.receipt.payments || []).map(
            (p: any) => ({
              id: p.id || undefined,
              method: p.method,
              amount: r2(p.amount),
              reference: p.reference,
            })
          ),
        };
        hydrateFromInvoice(mapped);
        toast.success("Invoice loaded for refund");
      } else if (res && res.error) {
        toast.error(res.error);
      } else {
        toast.error("Could not load invoice");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to load invoice");
    } finally {
      setSelectingInvoiceId(null);
    }
  }

  function backToLanding() {
    setInvoice(null);
    setStandaloneMode(false);
    setLines([]);
    setSearchSearched(false);
    setSearchResults([]);
  }

  function enterStandaloneMode() {
    setInvoice(null);
    setStandaloneMode(true);
    setLines([]);
  }

  const subTotal = useMemo(
    () =>
      r2(
        lines.reduce(
          (s, l) => s + r2(l.quantity) * r2(l.unitPrice),
          0
        )
      ),
    [lines]
  );
  const lineDisc = useMemo(
    () => lines.reduce((s, l) => s + r2(l.discount), 0),
    [lines]
  );
  const totalDiscount = r2(lineDisc + r2(cartDiscount));
  const grandTotal = Math.max(0, r2(subTotal - totalDiscount));

  function updateLine(idx: number, patch: Partial<(typeof lines)[number]>) {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const next: any = { ...l, ...patch };
        if (patch.quantity != null || patch.unitPrice != null) {
          const maxQ = next.maxQuantity != null ? Number(next.maxQuantity) : Infinity;
          const q = Math.min(maxQ, Math.max(0, r2(next.quantity)));
          next.quantity = q;
          const u = r2(next.unitPrice);
          const d = Math.min(r2(next.discount), r2(q * u));
          next.discount = d;
          next.amount = r2(q * u - d);
        }
        return next;
      })
    );
  }

  function addStandaloneLine() {
    setLines((prev) => [
      ...prev,
      {
        itemId: null,
        description: "",
        quantity: 1,
        unitPrice: 0,
        discount: 0,
        amount: 0,
      },
    ]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function toggleAllLines(refundAll: boolean) {
    if (branch !== "INVOICE_REVERSAL" || !invoice) return;
    if (refundAll) {
      hydrateFromInvoice(invoice);
    } else {
      setLines([]);
    }
  }

  async function handleConfirm() {
    if (lines.length === 0) {
      toast.error("Add at least one refund line");
      return;
    }
    if (grandTotal <= 0) {
      toast.error("Refund total must be greater than 0");
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = {
        branch,
        refundMethod,
        refundAccountId:
          refundMethod === "CASH"
            ? defaultCashAccountId || undefined
            : refundMethod === "BANK"
            ? defaultBankAccountId || undefined
            : undefined,
        reason: reason.trim() || null,
        note: note.trim() || null,
        lines: lines.map((l) => ({
          itemId: l.itemId || undefined,
          description: l.description.trim() || "Refund line",
          quantity: Math.max(0, r2(l.quantity)),
          unitPrice: r2(l.unitPrice),
          discount: r2(l.discount),
          amount: r2(l.amount),
          batchNumber: l.batchNumber || null,
          expiryDate: l.expiryDate ? new Date(l.expiryDate).toISOString() : null,
          warehouseName: l.warehouseName || null,
          itemBatchId: l.itemBatchId || null,
        })),
        cartDiscount: r2(cartDiscount),
      };
      if (branch === "INVOICE_REVERSAL") {
        if (!invoice?.id) {
          toast.error("Invoice is required for invoice reversal refunds");
          return;
        }
        payload.invoiceId = invoice.id;
        if (invoice.customerId) payload.partyId = invoice.customerId;
        const payments = invoice.payments || [];
        if (payments.length === 1) {
          payload.sourcePaymentId = payments[0].id || undefined;
        }
      } else {
        payload.partyId = walkinCustomerId;
      }
      const res: any = await posRefundClient(payload);
      if (res && res.ok) {
        const payload: any = res.data ?? res;
        setLastResult({
          ok: true,
          refundId: payload.refundId,
          refundNumber: payload.refundNumber,
          grandTotal: r2(payload.grandTotal),
        });
        toast.success(`Refund ${payload.refundNumber ?? ""} issued`.trim());
      } else if (res && typeof res === "object" && "ok" in res) {
        setLastResult({ ok: false, error: res.error || res.detail || "Refund failed" });
        toastActionError(res, { fallback: "Refund failed" });
      } else {
        setLastResult({ ok: false, error: "Refund failed" });
        toast.error("Refund failed");
      }
    } catch (err: any) {
      setLastResult({ ok: false, error: err?.message || "Refund failed" });
      toastActionError(err, { fallback: "Refund failed" });
    } finally {
      setSubmitting(false);
    }
  }

  const methodAccountWarn =
    (refundMethod === "CASH" && !defaultCashAccountId) ||
    (refundMethod === "BANK" && !defaultBankAccountId);

  return (
    <div
      className={`fixed inset-0 z-[65] transition-opacity duration-150 ${
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      <style>{`
        @media print {
          body > * { visibility: hidden !important; }
          #pos-refund-print-root, #pos-refund-print-root * { visibility: visible !important; }
          #pos-refund-print-root {
            position: absolute !important;
            left: 0 !important; top: 0 !important;
            width: 80mm !important;
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 3mm !important;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
          }
          .no-print { display: none !important; }
          @page { size: 80mm auto; margin: 0; }
        }
      `}</style>
      <div className="absolute inset-0 bg-black/50 no-print" onClick={onClose} />
      <div className="relative z-10 h-full w-full max-w-4xl mx-auto p-3 sm:p-6 flex items-stretch">
        <div className="bg-background rounded-xl border border-border shadow-2xl w-full flex flex-col max-h-full overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-3 no-print">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold text-foreground">Issue POS Refund</div>
                <div className="text-xs text-muted-foreground max-w-lg">
                  {invoice
                    ? `Reversing ${invoice.invoiceNumber || "invoice"} — cancels invoice, reverses stock, payments, and journals.`
                    : standaloneMode
                    ? "Standalone refund journal — debits sales, credits tender. No invoice or inventory changes."
                    : "Find an order to reverse, or start a standalone refund journal entry."}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          {lastResult?.ok && (
            <div id="pos-refund-print-root">
              <div className="space-y-2 text-[11px] font-mono p-3">
                <div className="text-center font-bold text-sm">REFUND RECEIPT</div>
                <div className="text-center text-xs">{lastResult.refundNumber}</div>
                <div className="border-t border-dashed border-black/40 my-1"></div>
                <div className="flex justify-between">
                  <span>Type:</span>
                  <span>{branch === "INVOICE_REVERSAL" ? "Inv Reversal" : "Standalone JE"}</span>
                </div>
                {invoice?.invoiceNumber && (
                  <div className="flex justify-between">
                    <span>Invoice:</span>
                    <span>{invoice.invoiceNumber}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{new Date().toLocaleDateString("en-GB")} {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Method:</span>
                  <span>{refundMethod}</span>
                </div>
                <div className="border-t border-dashed border-black/40 my-1"></div>
                {lines.map((l, i) => (
                  <div key={i} className="border-b border-dotted border-black/10 py-1">
                    <div className="font-medium">{l.description}</div>
                    <div className="flex justify-between">
                      <span>
                        {l.quantity} × {fmt(r2(l.unitPrice))}
                        {l.discount ? ` −${fmt(r2(l.discount))}` : ""}
                      </span>
                      <span>{fmt(r2(l.amount))}</span>
                    </div>
                  </div>
                ))}
                <div className="border-t border-dashed border-black/40 my-1"></div>
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{fmt(subTotal)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Discount</span>
                  <span>-{fmt(totalDiscount)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm pt-1">
                  <span>Refund total</span>
                  <span>-{fmt(grandTotal)}</span>
                </div>
                {reason && (
                  <div className="pt-1 text-[10px]">Reason: {reason}</div>
                )}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {lastResult?.ok ? (
              <div className="p-5 sm:p-7 max-w-2xl mx-auto space-y-5 no-print">
                <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-4 flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="font-semibold text-emerald-800">Refund issued successfully</div>
                    <div className="text-xs text-emerald-900/80 mt-1">
                      Refund #{lastResult.refundNumber} • Amount{" "}
                      <span className="font-semibold">
                        -{fmt(r2(lastResult.grandTotal))}
                      </span>{" "}
                      via {refundMethod}
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm">
                  <div className="font-medium text-foreground">Refund effects</div>
                  <ul className="mt-2 list-disc pl-5 space-y-1 text-muted-foreground text-xs">
                    {branch === "INVOICE_REVERSAL" ? (
                      <>
                        <li>Returned item quantities restored to inventory</li>
                        <li>Sales revenue reduced and reversal payment recorded</li>
                        <li>Invoice remains eligible for remaining returns until fully refunded</li>
                        <li>
                          Shift <code>refundTotal</code> incremented,{" "}
                          <code>{refundMethod.toLowerCase()}Expected</code> decremented
                        </li>
                      </>
                    ) : (
                      <>
                        <li>No changes to any original invoice</li>
                        <li>Journal entry debits Sales, credits tender account</li>
                        <li>Shift refundTotal incremented and expected tender reduced</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="p-5 sm:p-6 space-y-5">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 text-xs">
                      <span
                        className={`px-2.5 py-1 rounded-md font-semibold text-xs border ${
                          invoice
                            ? "bg-emerald-500/10 text-emerald-800 border-emerald-500/30"
                            : standaloneMode
                            ? "bg-amber-500/10 text-amber-800 border-amber-500/30"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        {invoice
                          ? "Branch A · Invoice Reversal"
                          : standaloneMode
                          ? "Branch B · Standalone JE"
                          : "Select refund target"}
                      </span>
                      {(invoice || standaloneMode) && (
                        <button
                          onClick={backToLanding}
                          className="px-2.5 py-1 rounded-md border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/60 inline-flex items-center gap-1 transition-colors"
                        >
                          <ArrowLeftIcon className="h-3.5 w-3.5" />
                          {invoice ? "Change / detach invoice" : "Back to invoice lookup"}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1 md:min-w-[360px]">
                    <label className="text-xs font-medium text-muted-foreground block mb-1">
                      Refund method
                    </label>
                    <div className="grid grid-cols-4 gap-1 text-xs">
                      {(["CASH", "CARD", "BANK", "WALLET"] as Method[]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setRefundMethod(m)}
                          className={`px-2 py-2 rounded-md border font-semibold transition-colors ${
                            refundMethod === m
                              ? "bg-rose-500/10 text-rose-700 border-rose-500/40"
                              : "border-border text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                          }`}
                        >
                          {m.charAt(0) + m.slice(1).toLowerCase()}
                        </button>
                      ))}
                    </div>
                    {methodAccountWarn && (
                      <div className="text-[11px] text-amber-700/90 flex items-start gap-1 mt-1">
                        <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                        <span>
                          Configure a default{" "}
                          {refundMethod === "CASH" ? "cash" : "bank"} account on the POS profile to
                          auto-route the refund.
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {showLanding && (
                  <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-4">
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        Find order to refund
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Search past POS invoices by invoice number or customer name (default: last
                        60 days). Select a row to issue a full/partial invoice reversal.
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 text-sm">
                      <div className="md:col-span-5">
                        <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                          Invoice # or customer
                        </label>
                        <div className="relative">
                          <SearchIcon className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            list="refund-search-suggestions"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                runSearch(false);
                              }
                            }}
                            placeholder="e.g. POS-00009 or Walk-in Customer"
                            className="w-full rounded-md border border-input pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-minia-primary/40"
                          />
                          <datalist id="refund-search-suggestions">
                            {Array.from(
                              new Set(
                                searchResults.flatMap((r: any) => [
                                  r.invoiceNumber,
                                  r.customerName,
                                  r.customerPhone,
                                ]).filter(Boolean)
                              )
                            ).map((val: string) => (
                              <option key={val} value={val} />
                            ))}
                          </datalist>
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                          From
                        </label>
                        <input
                          type="date"
                          value={searchFromDate}
                          onChange={(e) => setSearchFromDate(e.target.value)}
                          className="w-full rounded-md border border-input px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-minia-primary/40"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                          To
                        </label>
                        <input
                          type="date"
                          value={searchToDate}
                          onChange={(e) => setSearchToDate(e.target.value)}
                          className="w-full rounded-md border border-input px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-minia-primary/40"
                        />
                      </div>
                      <div className="md:col-span-3 flex items-end gap-2">
                        <button
                          onClick={() => runSearch(false)}
                          disabled={searchLoading}
                          className="px-3 py-2 rounded-md bg-minia-primary text-white text-sm font-semibold hover:brightness-95 disabled:opacity-40 inline-flex items-center gap-2 transition-colors w-full md:w-auto justify-center"
                        >
                          {searchLoading && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                          {searchLoading ? "Searching…" : "Search orders"}
                        </button>
                      </div>
                    </div>
                    <div className="rounded-lg border border-border overflow-hidden">
                      <div className="bg-muted/30 px-3 py-2 grid grid-cols-12 gap-2 text-[11px] font-medium text-muted-foreground border-b border-border">
                        <div className="col-span-3">Invoice</div>
                        <div className="col-span-4">Customer</div>
                        <div className="col-span-2 text-right">Date</div>
                        <div className="col-span-2 text-right">Refundable / Total</div>
                        <div className="col-span-1 text-right">Action</div>
                      </div>
                      {searchLoading ? (
                        <div className="px-3 py-8 text-sm text-muted-foreground text-center">
                          <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                          Loading invoices…
                        </div>
                      ) : !searchSearched ? (
                        <div className="px-3 py-8 text-sm text-muted-foreground text-center">
                          Type a customer name or invoice number above, or click &ldquo;Search orders&rdquo;
                          to see recent invoices.
                        </div>
                      ) : searchResults.length === 0 ? (
                        <div className="px-3 py-8 text-sm text-muted-foreground text-center">
                          No non-cancelled POS invoices matched the search.
                        </div>
                      ) : (
                        <div className="max-h-64 overflow-y-auto divide-y divide-border/50">
                          {searchResults.map((r: any) => (
                            <div
                              key={r.id}
                              className="px-3 py-2 grid grid-cols-12 gap-2 items-center text-sm hover:bg-accent/40 transition-colors"
                            >
                              <div className="col-span-3 min-w-0">
                                <div className="font-medium text-foreground truncate">
                                  {r.invoiceNumber}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {r.status || "—"} • {r.itemsCount || 0} item
                                  {(r.itemsCount || 0) === 1 ? "" : "s"}
                                </div>
                              </div>
                              <div className="col-span-4 min-w-0">
                                <div className="text-sm text-foreground truncate font-medium">
                                  {r.customerName}
                                </div>
                                {r.customerPhone && (
                                  <div className="text-[10px] text-muted-foreground truncate">{r.customerPhone}</div>
                                )}
                              </div>
                              <div className="col-span-2 text-right text-xs text-muted-foreground">
                                {r.date
                                  ? new Date(r.date).toLocaleDateString("en-GB")
                                  : "—"}
                              </div>
                              <div className="col-span-2 text-right">
                                <div className="font-medium text-foreground">
                                  {fmt(r.remainingRefundableAmount ?? r.grandTotal)}
                                </div>
                                {r.totalRefunded > 0 ? (
                                  <div className="text-[10px] text-amber-600 font-semibold">
                                    Partial ({fmt(r.totalRefunded)} refunded)
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-muted-foreground">
                                    Full total: {fmt(r.grandTotal)}
                                  </div>
                                )}
                              </div>
                              <div className="col-span-1 text-right">
                                <button
                                  onClick={() => selectInvoiceForRefund(r)}
                                  disabled={selectingInvoiceId === r.id}
                                  title="Refund this invoice"
                                  className="p-1.5 rounded-md border border-rose-500/30 bg-rose-500/5 text-rose-600 hover:bg-rose-500/10 transition-colors disabled:opacity-40 inline-flex items-center justify-center"
                                >
                                  {selectingInvoiceId === r.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RotateCcw className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-border/60">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                          Tip
                        </span>
                        <span>
                          Prefer invoice reversal when possible — it cancels the original invoice,
                          restores stock, reverses journals, and creates a mirrored refund payment.
                        </span>
                      </div>
                      <button
                        onClick={enterStandaloneMode}
                        className="px-3 py-2 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-900 text-xs font-semibold hover:bg-amber-500/20 transition-colors"
                      >
                        + Standalone refund (no invoice)
                      </button>
                    </div>
                  </div>
                )}

                {standaloneMode && !invoice && (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm space-y-1">
                    <div className="flex items-start gap-2 text-amber-900">
                      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold">Standalone refund (Branch B)</div>
                        <div className="mt-1 text-amber-900/90 text-xs">
                          This creates a direct journal entry debiting your sales account and
                          crediting the tendered account. It does NOT touch any original invoice
                          or reverse inventory. Use this for off-invoice compensations only.
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={addStandaloneLine}
                      className="mt-3 px-3 py-1.5 rounded-md border border-amber-400/50 bg-background hover:bg-amber-500/10 text-amber-900 text-xs font-semibold transition-colors"
                    >
                      + Add refund line
                    </button>
                  </div>
                )}

                {invoice && (
                  <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">
                          Refund against invoice
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Stocks & payments for the selected lines will be reversed against the
                          original invoice.
                        </div>
                      </div>
                      {invoice?.id && (
                        <button
                          onClick={() => toggleAllLines(lines.length === 0)}
                          className="text-xs px-3 py-1.5 rounded-md border border-border bg-background hover:bg-accent text-foreground font-medium transition-colors"
                        >
                          {lines.length === 0 ? "Refund all lines" : "Clear lines"}
                        </button>
                      )}
                    </div>
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm space-y-1">
                      <div className="flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-emerald-700" />
                        <span className="font-semibold text-emerald-800">
                          {invoice.invoiceNumber || "Invoice selected"}
                        </span>
                        {invoice.status && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 font-medium">
                            {invoice.status}
                          </span>
                        )}
                        {(invoice as any).remainingRefundableAmount != null &&
                          (invoice as any).remainingRefundableAmount < (invoice.grandTotal ?? 0) && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-800 font-medium">
                              Partial return eligible
                            </span>
                          )}
                      </div>
                      <div className="text-xs text-emerald-900/80 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span>Customer: {invoice.customerName || "Walk-in"}</span>
                        {invoice.date && (
                          <span>
                            Date: {new Date(invoice.date).toLocaleDateString("en-GB")}{" "}
                            {new Date(invoice.date).toLocaleTimeString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                        <span>Original total: {fmt(r2(invoice.grandTotal))}</span>
                        {(invoice as any).remainingRefundableAmount != null && (
                          <span className="font-semibold text-emerald-900">
                            Available to refund: {fmt(r2((invoice as any).remainingRefundableAmount))}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                        Tip
                      </span>
                      <span>
                        The original invoice was pre-loaded from your selection. You can add,
                        remove, or edit lines and quantities before issuing.
                      </span>
                    </div>
                  </div>
                )}

                {!showLanding && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-foreground">Refund lines</div>
                      <div className="text-xs text-muted-foreground">
                        {lines.length} {lines.length === 1 ? "line" : "lines"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border overflow-hidden">
                      {lines.length === 0 ? (
                        <div className="py-10 text-center text-sm text-muted-foreground">
                          No refund lines yet.
                          {invoice
                            ? ' Click "Refund all lines" above, or add a line manually.'
                            : " Add a standalone refund line above."}
                        </div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="bg-muted/30 text-xs text-muted-foreground border-b border-border">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium">Description</th>
                              <th className="px-2 py-2 text-right font-medium w-[76px]">Qty</th>
                              <th className="px-2 py-2 text-right font-medium w-[96px]">
                                Price
                              </th>
                              <th className="px-2 py-2 text-right font-medium w-[88px]">
                                Disc
                              </th>
                              <th className="px-3 py-2 text-right font-medium w-[96px]">
                                Amount
                              </th>
                              <th className="w-9"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/50">
                            {lines.map((l, idx) => (
                              <tr key={idx}>
                                <td className="px-3 py-2 align-top">
                                  <input
                                    value={l.description}
                                    onChange={(e) =>
                                      updateLine(idx, { description: e.target.value })
                                    }
                                    placeholder={
                                      invoice
                                        ? "Item description"
                                        : "e.g. Customer complaint refund"
                                    }
                                    className="w-full rounded-md border border-transparent hover:border-border focus:border-input px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-minia-primary/30 bg-transparent"
                                  />
                                  <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
                                    {(l as any).originalQuantity != null && (l as any).refundedQuantity > 0 && (
                                      <span className="inline-flex items-center rounded-md bg-amber-500/10 text-amber-800 border border-amber-500/20 px-1.5 py-0.5 font-medium">
                                        {(l as any).refundedQuantity} of {(l as any).originalQuantity} previously returned
                                      </span>
                                    )}
                                    {l.batchNumber && (
                                      <span className="inline-flex items-center rounded-md bg-indigo-500/10 text-indigo-700 border border-indigo-500/20 px-1.5 py-0.5 font-medium">
                                        Batch {l.batchNumber}
                                      </span>
                                    )}
                                    {l.expiryDate && (
                                      <span className="inline-flex items-center rounded-md bg-amber-500/10 text-amber-800 border border-amber-500/20 px-1.5 py-0.5 font-medium">
                                        Exp {String(l.expiryDate).slice(0, 10)}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-2 py-2 align-top">
                                  <input
                                    type="number"
                                    min={0}
                                    max={(l as any).maxQuantity != null ? (l as any).maxQuantity : undefined}
                                    step="1"
                                    value={l.quantity}
                                    onChange={(e) =>
                                      updateLine(idx, {
                                        quantity: r2(Number(e.target.value) || 0),
                                      })
                                    }
                                    className="w-full rounded-md border border-border px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-minia-primary/30"
                                  />
                                  {(l as any).maxQuantity != null && (
                                    <div className="text-[10px] text-muted-foreground text-right mt-0.5">
                                      max: {(l as any).maxQuantity}
                                    </div>
                                  )}
                                </td>
                                <td className="px-2 py-2 align-top">
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={l.unitPrice}
                                    onChange={(e) =>
                                      updateLine(idx, {
                                        unitPrice: r2(Number(e.target.value) || 0),
                                      })
                                    }
                                    className="w-full rounded-md border border-border px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-minia-primary/30"
                                  />
                                </td>
                                <td className="px-2 py-2 align-top">
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={l.discount > 0 ? l.discount : ""}
                                    onChange={(e) =>
                                      updateLine(idx, {
                                        discount: r2(Number(e.target.value) || 0),
                                      })
                                    }
                                    placeholder="0"
                                    className="w-full rounded-md border border-border px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-minia-primary/30"
                                  />
                                </td>
                                <td className="px-3 py-2 align-top text-right font-semibold text-foreground">
                                  {fmt(r2(l.amount))}
                                </td>
                                <td className="px-1 py-2 align-top text-right">
                                  <button
                                    onClick={() => removeLine(idx)}
                                    className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-500/10 transition-colors"
                                    title="Remove line"
                                  >
                                    <XIcon className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}

                {!showLanding && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Reason (short, printed on receipt)
                        </label>
                        <input
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="e.g. Wrong item, damaged, customer return…"
                          className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-minia-primary/40"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Internal note (optional, not printed)
                        </label>
                        <textarea
                          rows={2}
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Manager approval, references, etc."
                          className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-minia-primary/40"
                        />
                      </div>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-medium text-foreground">{fmt(subTotal)}</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Cart discount (Rs)</span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={cartDiscount > 0 ? cartDiscount : ""}
                            onChange={(e) =>
                              setCartDiscount(r2(Math.max(0, Number(e.target.value) || 0)))
                            }
                            placeholder="0"
                            className="w-28 rounded-md border border-border px-2 py-1 text-right text-xs focus:outline-none focus:ring-1 focus:ring-minia-primary/40"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-red-600">
                        <span>Total discount</span>
                        <span className="font-medium">-{fmt(totalDiscount)}</span>
                      </div>
                      <div className="h-px bg-border/70 my-1" />
                      <div className="flex items-center justify-between text-base">
                        <span className="font-semibold text-foreground">Refund total</span>
                        <span className="text-xl font-bold text-rose-600">-{fmt(grandTotal)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="px-5 py-3 border-t border-border bg-muted/10 flex items-center justify-between gap-3 no-print">
            <div className="text-xs text-muted-foreground max-w-lg">
              {lastResult?.ok ? (
                <>Refund receipt is ready to print. Close when done.</>
              ) : showLanding ? (
                <>
                  Select an invoice from the results above, or click{" "}
                  <span className="font-semibold text-foreground">+ Standalone refund</span> to
                  record a direct journal entry without touching any order.
                </>
              ) : (
                <>
                  You will issue{" "}
                  <span className="font-semibold text-foreground">-{fmt(grandTotal)}</span> by{" "}
                  <span className="font-semibold text-foreground">{refundMethod}</span>
                  {invoice ? (
                    <>
                      {" "}against{" "}
                      <span className="font-semibold text-foreground">
                        {invoice.invoiceNumber || "this invoice"}
                      </span>
                      .
                    </>
                  ) : (
                    <> as Branch B (standalone JE).</>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!lastResult?.ok ? (
                <>
                  <button
                    onClick={onClose}
                    className="px-3 py-2 rounded-md border border-border hover:bg-accent text-sm font-medium text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={
                      submitting ||
                      grandTotal <= 0 ||
                      lines.length === 0 ||
                      showLanding
                    }
                    className="px-4 py-2 rounded-md bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2 transition-colors"
                  >
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {submitting ? "Issuing refund…" : "Issue Refund"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      window.print();
                    }}
                    className="px-4 py-2 rounded-md bg-minia-primary text-white text-sm font-semibold hover:brightness-95 disabled:opacity-40 inline-flex items-center gap-2 transition-colors"
                  >
                    <Receipt className="h-4 w-4" />
                    Print Receipt
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-md border border-border bg-background hover:bg-accent text-sm font-medium text-foreground transition-colors"
                  >
                    Done
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
