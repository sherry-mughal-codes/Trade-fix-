"use client";

import { useEffect, useMemo, useState } from "react";
import { X as XIcon, FileText, Printer, AlertCircle, Loader2 } from "lucide-react";
import { toast, ToastOptions } from "react-hot-toast";
import { toastActionError } from "@/components/providers/toast";
import { generatePOSReportClient } from "../_actions_client";

const toastOpts: ToastOptions = { duration: 4500 };

export type POSReportKind = "X" | "Z";

interface ReportSummary {
  shiftNumber?: string | null;
  openingFloat: number;
  billsCount: number;
  itemsCount: number;
  refundCount: number;
  grossSales: number;
  discountTotal: number;
  refundTotal: number;
  netSales: number;
  tenderBreakdown: Record<string, number>;
  splitTenderCount: number;
  cashExpected: number;
  cardExpected: number;
  bankExpected: number;
  walletExpected: number;
  cashVariance?: number | null;
  cardVariance?: number | null;
  bankVariance?: number | null;
  walletVariance?: number | null;
}

interface LineItemRow {
  id: string;
  invoiceNumber: string;
  customerName?: string | null;
  date?: string | Date;
  status?: string | null;
  subTotal: number;
  discountTotal: number;
  grandTotal: number;
  paidAmount: number;
  items: number;
  isCredit?: boolean;
}

interface POSReportModalProps {
  open: boolean;
  onClose: () => void;
  kind: POSReportKind;
  shiftRef?: { id: string } | null;
  userName?: string | null;
}

const fmt = (n: number | null | undefined) =>
  `Rs ${(Number(n) || 0).toFixed(2)}`;

const pname = (m: string) => {
  const map: Record<string, string> = {
    CASH: "Cash",
    CARD: "Card",
    BANK: "Bank",
    WALLET: "Wallet",
    CREDIT: "Credit",
  };
  return map[m] || m;
};

export default function POSReportModal({
  open,
  onClose,
  kind,
  userName,
}: POSReportModalProps) {
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [submittingZ, setSubmittingZ] = useState(false);
  const [snapshotId, setSnapshotId] = useState<string | null>(null);
  const [snapshotNumber, setSnapshotNumber] = useState<string | null>(null);
  const [shiftClosed, setShiftClosed] = useState(false);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [lineItems, setLineItems] = useState<LineItemRow[]>([]);
  const [closingInputs, setClosingInputs] = useState<{
    closingCash: string;
    closingCard: string;
    closingBank: string;
    closingWallet: string;
    closeNotes: string;
  }>({
    closingCash: "",
    closingCard: "",
    closingBank: "",
    closingWallet: "",
    closeNotes: "",
  });
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!open) return;
    setSnapshotId(null);
    setSnapshotNumber(null);
    setShiftClosed(false);
    setSummary(null);
    setLineItems([]);
    setGeneratedAt(null);
    setClosingInputs({
      closingCash: "",
      closingCard: "",
      closingBank: "",
      closingWallet: "",
      closeNotes: "",
    });
  }, [open, kind]);

  const xReportData = useMemo(
    () => summary || null,
    [summary]
  );

  async function handleGenerateX() {
    setLoading(true);
    try {
      const res: any = await generatePOSReportClient("X");
      if (res && res.ok) {
        const payload: any = res.data ?? res;
        setSnapshotId(payload.snapshotId);
        setSnapshotNumber(payload.snapshotNumber);
        setSummary(payload.summary);
        setLineItems(payload.lineItems || []);
        setGeneratedAt(new Date());
        toast.success(`X Report ${payload.snapshotNumber ?? ""} generated`.trim(), toastOpts);
      } else {
        toastActionError(res ?? "Failed to generate X Report", { fallback: "Failed to generate X Report" });
      }
    } catch (err: any) {
      toastActionError(err, { fallback: "X report failed" });
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateZAndClose() {
    setSubmittingZ(true);
    try {
      const closing = {
        closingCash:
          closingInputs.closingCash.trim() !== ""
            ? Number(closingInputs.closingCash)
            : null,
        closingCard:
          closingInputs.closingCard.trim() !== ""
            ? Number(closingInputs.closingCard)
            : null,
        closingBank:
          closingInputs.closingBank.trim() !== ""
            ? Number(closingInputs.closingBank)
            : null,
        closingWallet:
          closingInputs.closingWallet.trim() !== ""
            ? Number(closingInputs.closingWallet)
            : null,
        closeNotes: closingInputs.closeNotes.trim() || null,
      };
      const res: any = await generatePOSReportClient("Z", closing);
      if (res && res.ok) {
        const payload: any = res.data ?? res;
        setSnapshotId(payload.snapshotId);
        setSnapshotNumber(payload.snapshotNumber);
        setSummary(payload.summary);
        setLineItems(payload.lineItems || []);
        setShiftClosed(Boolean(payload.shiftClosed));
        setGeneratedAt(new Date());
        const no = payload.snapshotNumber ?? "";
        toast.success(
          payload.shiftClosed
            ? `Z Report ${no} — Shift closed`.trim()
            : `Z Report ${no} generated`.trim(),
          toastOpts
        );
      } else {
        toastActionError(res ?? "Failed to generate Z Report", { fallback: "Failed to generate Z Report" });
      }
    } catch (err: any) {
      toastActionError(err, { fallback: "Z report failed" });
    } finally {
      setSubmittingZ(false);
    }
  }

  function handlePrint() {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrinting(false), 250);
    }, 200);
  }

  const title = kind === "X" ? "Mid-Shift (X) Report" : "Shift End (Z) Report";
  const isX = kind === "X";

  const handleModalClose = () => {
    if (shiftClosed) {
      window.location.href = "/pos";
      return;
    }
    onClose();
  };

  return (
    <div
      className={`fixed inset-0 z-[60] transition-opacity duration-150 ${
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      <style>{`
        @media print {
          body > * { visibility: hidden !important; }
          #pos-report-print-root, #pos-report-print-root * { visibility: visible !important; }
          #pos-report-print-root {
            position: absolute !important;
            left: 0 !important; top: 0 !important;
            width: 210mm !important;
            min-height: 297mm !important;
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 16mm !important;
            font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif !important;
          }
          .no-print { display: none !important; }
          @page { size: A4; margin: 10mm; }
        }
      `}</style>
      <div className="absolute inset-0 bg-black/50 no-print" onClick={handleModalClose} />
      <div className="relative z-10 h-full w-full max-w-5xl mx-auto p-3 sm:p-6 flex flex-col items-stretch">
        <div className="bg-background rounded-xl border border-border shadow-2xl flex flex-col max-h-full overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-3 no-print">
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                isX ? "bg-sky-500/15 text-sky-600" : "bg-violet-500/15 text-violet-600"
              }`}>
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-foreground">{title}</div>
                <div className="text-xs text-muted-foreground truncate max-w-lg">
                  {isX
                    ? "Live mid-shift snapshot. Shift remains open after generation."
                    : "End-of-day reconciliation. Once confirmed, the shift is closed (locked)."}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {snapshotNumber && (
                <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-medium ${
                  isX ? "bg-sky-500/10 text-sky-700 border-sky-500/20" : "bg-violet-500/10 text-violet-700 border-violet-500/20"
                }`}>
                  {snapshotNumber}
                </span>
              )}
              <button
                onClick={handleModalClose}
                className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div
              id="pos-report-print-root"
              className="p-5 sm:p-7 text-foreground"
            >
              {!xReportData && isX && (
                <div className="py-12 text-center space-y-3">
                  <div className="mx-auto max-w-md text-sm text-muted-foreground">
                    Click <span className="font-semibold text-foreground">Generate X Report</span> below
                    to produce a live mid-shift snapshot of sales, payments and items.
                    No counters or shift status are changed.
                  </div>
                </div>
              )}

              {!xReportData && !isX && (
                <div className="max-w-2xl mx-auto py-6 space-y-5">
                  <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm space-y-2">
                    <div className="flex items-start gap-2 text-amber-800">
                      <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold">You are about to close the shift.</div>
                        <div className="mt-1 text-amber-900/90">
                          Enter the physical counts for each tender you have on hand.
                          Variance = counted − expected. Once generated, this shift is locked.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Closing cash counted
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={closingInputs.closingCash}
                        onChange={(e) =>
                          setClosingInputs((s) => ({ ...s, closingCash: e.target.value }))
                        }
                        placeholder="0.00"
                        className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-minia-primary/40"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Closing card settled
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={closingInputs.closingCard}
                        onChange={(e) =>
                          setClosingInputs((s) => ({ ...s, closingCard: e.target.value }))
                        }
                        placeholder="0.00"
                        className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-minia-primary/40"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Closing bank transfers
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={closingInputs.closingBank}
                        onChange={(e) =>
                          setClosingInputs((s) => ({ ...s, closingBank: e.target.value }))
                        }
                        placeholder="0.00"
                        className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-minia-primary/40"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Closing wallet settled
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={closingInputs.closingWallet}
                        onChange={(e) =>
                          setClosingInputs((s) => ({ ...s, closingWallet: e.target.value }))
                        }
                        placeholder="0.00"
                        className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-minia-primary/40"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Close notes / declaration (optional)
                      </label>
                      <textarea
                        rows={2}
                        value={closingInputs.closeNotes}
                        onChange={(e) =>
                          setClosingInputs((s) => ({ ...s, closeNotes: e.target.value }))
                        }
                        placeholder="Declare any discrepancies, late deposits, etc."
                        className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-minia-primary/40"
                      />
                    </div>
                  </div>
                </div>
              )}

              {xReportData && (
                <div className="space-y-6">
                  <div className="border-b border-border pb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-bold">
                        {kind === "X" ? "X Report" : "Z Report"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {snapshotNumber || "—"} · Shift{" "}
                        {xReportData.shiftNumber || "—"} · Generated{" "}
                        {generatedAt
                          ? `${generatedAt.toLocaleDateString("en-GB")} ${generatedAt.toLocaleTimeString(
                              "en-GB",
                              { hour: "2-digit", minute: "2-digit", second: "2-digit" }
                            )}`
                          : "—"}
                        {userName ? ` · Cashier: ${userName}` : ""}
                      </div>
                      {shiftClosed && (
                        <div className="mt-1 inline-flex items-center rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          Shift CLOSED
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Bills", value: xReportData.billsCount },
                      { label: "Items", value: xReportData.itemsCount },
                      { label: "Refunds", value: xReportData.refundCount },
                      { label: "Split Tenders", value: xReportData.splitTenderCount },
                    ].map((c) => (
                      <div
                        key={c.label}
                        className="rounded-xl border border-border bg-muted/20 p-3"
                      >
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                          {c.label}
                        </div>
                        <div className="mt-1 text-lg font-bold text-foreground">
                          {Number(c.value || 0).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl border border-border divide-y divide-border/60">
                    {[
                      { label: "Gross sales", value: fmt(xReportData.grossSales) },
                      { label: "Discounts", value: `-${fmt(xReportData.discountTotal)}`, cls: "text-red-600" },
                      { label: "Refunds", value: `-${fmt(xReportData.refundTotal)}`, cls: "text-red-600" },
                    ].map((r, idx, arr) => (
                      <div
                        key={r.label}
                        className={`flex items-center justify-between px-4 py-2 ${
                          idx === arr.length - 1 ? "" : ""
                        }`}
                      >
                        <span className="text-sm text-muted-foreground">{r.label}</span>
                        <span className={`text-sm font-semibold ${r.cls || "text-foreground"}`}>
                          {r.value}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/20">
                      <span className="font-semibold text-foreground">Net sales</span>
                      <span className="text-lg font-bold text-minia-primary">
                        {fmt(xReportData.netSales)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-sm font-semibold text-foreground">
                      Tender breakdown
                    </div>
                    <table className="w-full text-sm border border-border rounded-xl overflow-hidden">
                      <thead className="bg-muted/30">
                        <tr className="text-xs text-muted-foreground">
                          <th className="text-left px-4 py-2 font-medium">Tender</th>
                          <th className="text-right px-4 py-2 font-medium">Sales</th>
                          <th className="text-right px-4 py-2 font-medium">Expected</th>
                          <th className="text-right px-4 py-2 font-medium">Counted</th>
                          <th className="text-right px-4 py-2 font-medium">Variance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {[
                          {
                            key: "CASH",
                            sale: xReportData.tenderBreakdown.CASH || 0,
                            expected: xReportData.cashExpected,
                            counted:
                              !isX && closingInputs.closingCash.trim() !== ""
                                ? Number(closingInputs.closingCash)
                                : null,
                            variance: xReportData.cashVariance,
                          },
                          {
                            key: "CARD",
                            sale: xReportData.tenderBreakdown.CARD || 0,
                            expected: xReportData.cardExpected,
                            counted:
                              !isX && closingInputs.closingCard.trim() !== ""
                                ? Number(closingInputs.closingCard)
                                : null,
                            variance: xReportData.cardVariance,
                          },
                          {
                            key: "BANK",
                            sale: xReportData.tenderBreakdown.BANK || 0,
                            expected: xReportData.bankExpected,
                            counted:
                              !isX && closingInputs.closingBank.trim() !== ""
                                ? Number(closingInputs.closingBank)
                                : null,
                            variance: xReportData.bankVariance,
                          },
                          {
                            key: "WALLET",
                            sale: xReportData.tenderBreakdown.WALLET || 0,
                            expected: xReportData.walletExpected,
                            counted:
                              !isX && closingInputs.closingWallet.trim() !== ""
                                ? Number(closingInputs.closingWallet)
                                : null,
                            variance: xReportData.walletVariance,
                          },
                          {
                            key: "CREDIT",
                            sale: xReportData.tenderBreakdown.CREDIT || 0,
                            expected: null,
                            counted: null,
                            variance: null,
                          },
                        ].map((r) => (
                          <tr key={r.key}>
                            <td className="px-4 py-2 font-medium text-foreground">
                              {pname(r.key)}
                            </td>
                            <td className="px-4 py-2 text-right text-foreground">
                              {fmt(r.sale)}
                            </td>
                            <td className="px-4 py-2 text-right text-muted-foreground">
                              {r.expected == null ? "—" : fmt(r.expected)}
                            </td>
                            <td className="px-4 py-2 text-right text-muted-foreground">
                              {r.counted == null ? "—" : fmt(r.counted)}
                            </td>
                            <td className={`px-4 py-2 text-right font-medium ${
                              r.variance == null
                                ? "text-muted-foreground"
                                : r.variance < 0
                                ? "text-red-600"
                                : r.variance > 0
                                ? "text-emerald-600"
                                : "text-foreground"
                            }`}>
                              {r.variance == null
                                ? "—"
                                : `${r.variance > 0 ? "+" : ""}${fmt(r.variance)}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {lineItems.length > 0 && (
                    <div>
                      <div className="mb-2 text-sm font-semibold text-foreground">
                        Shift activity ({lineItems.length} invoices)
                      </div>
                      <div className="rounded-xl border border-border overflow-hidden max-h-[42vh] overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-background/95 backdrop-blur border-b border-border">
                            <tr className="text-xs text-muted-foreground">
                              <th className="text-left px-4 py-2 font-medium">Invoice</th>
                              <th className="text-left px-4 py-2 font-medium">Customer</th>
                              <th className="text-left px-4 py-2 font-medium">Time</th>
                              <th className="text-right px-4 py-2 font-medium">Items</th>
                              <th className="text-right px-4 py-2 font-medium">Subtotal</th>
                              <th className="text-right px-4 py-2 font-medium">Disc</th>
                              <th className="text-right px-4 py-2 font-medium">Grand</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/50">
                            {lineItems.map((row) => (
                              <tr key={row.id}>
                                <td className="px-4 py-2 align-top font-medium text-foreground">
                                  {row.invoiceNumber}
                                </td>
                                <td className="px-4 py-2 align-top text-muted-foreground">
                                  {row.customerName || "Walk-in"}
                                  {row.isCredit ? (
                                    <span className="ml-1 inline-flex items-center rounded-md bg-amber-500/10 text-amber-700 border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium">
                                      Credit
                                    </span>
                                  ) : null}
                                </td>
                                <td className="px-4 py-2 align-top text-xs text-muted-foreground">
                                  {row.date
                                    ? new Date(row.date).toLocaleTimeString("en-GB", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        second: "2-digit",
                                      })
                                    : "—"}
                                </td>
                                <td className="px-4 py-2 align-top text-right text-foreground">
                                  {row.items}
                                </td>
                                <td className="px-4 py-2 align-top text-right text-muted-foreground">
                                  {fmt(row.subTotal)}
                                </td>
                                <td className="px-4 py-2 align-top text-right text-red-600">
                                  {row.discountTotal > 0 ? `-${fmt(row.discountTotal)}` : "—"}
                                </td>
                                <td className="px-4 py-2 align-top text-right font-semibold text-foreground">
                                  {fmt(row.grandTotal)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between gap-3 no-print">
            <div className="text-xs text-muted-foreground">
              {kind === "X"
                ? "X reports do not affect shift status. You can generate them repeatedly."
                : shiftClosed
                ? "This shift is now closed. Open a new counter shift to continue trading."
                : "You will not be able to reopen the shift after generating Z."}
            </div>
            <div className="flex items-center gap-2">
              {kind === "Z" && !shiftClosed && (
                <>
                  <button
                    onClick={onClose}
                    className="px-3 py-2 rounded-md border border-border hover:bg-accent text-sm font-medium text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGenerateZAndClose}
                    disabled={submittingZ}
                    className="px-4 py-2 rounded-md bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2 transition-colors"
                  >
                    {submittingZ && <Loader2 className="h-4 w-4 animate-spin" />}
                    {submittingZ
                      ? "Closing shift…"
                      : "Generate Z Report & Close Shift"}
                  </button>
                </>
              )}
              {kind === "X" && !summary && (
                <>
                  <button
                    onClick={handleModalClose}
                    className="px-3 py-2 rounded-md border border-border hover:bg-accent text-sm font-medium text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGenerateX}
                    disabled={loading}
                    className="px-4 py-2 rounded-md bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2 transition-colors"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Generate X Report
                  </button>
                </>
              )}
              {summary && (
                <>
                  {kind === "Z" && !shiftClosed && (
                    <button
                      onClick={handleModalClose}
                      className="px-3 py-2 rounded-md border border-border hover:bg-accent text-sm font-medium text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={handlePrint}
                    disabled={printing}
                    className="px-4 py-2 rounded-md bg-minia-primary text-white text-sm font-semibold hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2 transition-colors"
                  >
                    {printing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Printer className="h-4 w-4" />
                    )}
                    {printing ? "Printing…" : "Print Report"}
                  </button>
                  {kind === "X" && (
                    <button
                      onClick={handleGenerateX}
                      disabled={loading}
                      className="px-4 py-2 rounded-md border border-border bg-background hover:bg-accent text-sm font-medium text-foreground inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                      Re-generate
                    </button>
                  )}
                  {(kind === "X" || shiftClosed) && (
                    <button
                      onClick={handleModalClose}
                      className="px-4 py-2 rounded-md border border-border bg-background hover:bg-accent text-sm font-medium text-foreground transition-colors"
                    >
                      Close
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
