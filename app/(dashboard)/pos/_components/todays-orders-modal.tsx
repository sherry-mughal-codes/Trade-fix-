"use client";

import { useEffect, useState } from "react";
import {
  X,
  ClipboardCheck,
  Loader2,
  Receipt as ReceiptIcon,
  Printer,
  RotateCcw,
} from "lucide-react";
import {
  getTodaysOrdersClient,
  getInvoiceReceiptDuplicateClient,
} from "../_actions_client";
import Receipt, { type ReceiptData } from "./receipt";
import { toast } from "react-hot-toast";
import type { RefundTargetInvoice } from "./refund-dialog";

interface TodaysOrdersModalProps {
  open: boolean;
  onClose: () => void;
  shiftId: string;
  onRefundInvoice?: (inv: RefundTargetInvoice) => void;
  canRefund?: boolean;
}

interface TodaysOrderRow {
  id: string;
  invoiceNumber: string;
  date: string | Date;
  customerName: string;
  itemsCount: number;
  grandTotal: number;
  paidAmount: number;
  status: string;
  isCredit: boolean;
}

const fmt = (n: number) => `Rs ${Number(n || 0).toFixed(2)}`;
const fmtTime = (d: string | Date) => {
  const dt = new Date(d);
  return dt.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function TodaysOrdersModal({
  open,
  onClose,
  shiftId,
  onRefundInvoice,
  canRefund,
}: TodaysOrdersModalProps) {
  const [orders, setOrders] = useState<TodaysOrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [duplicateReceipt, setDuplicateReceipt] = useState<ReceiptData | null>(
    null,
  );
  const [duplicatePrint, setDuplicatePrint] = useState(false);

  useEffect(() => {
    if (!open || !shiftId) return;
    let active = true;
    setLoading(true);
    getTodaysOrdersClient(shiftId)
      .then((data: any) => {
        if (!active) return;
        setOrders(Array.isArray(data) ? (data as TodaysOrderRow[]) : []);
      })
      .catch(() => active && setOrders([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [open, shiftId]);

  useEffect(() => {
    if (!open) {
      setDuplicateReceipt(null);
      setDuplicatePrint(false);
    }
  }, [open]);

  async function handlePrintSlip(order: TodaysOrderRow) {
    setPrintingId(order.id);
    try {
      const res: any = await getInvoiceReceiptDuplicateClient(order.id);
      if (!res?.ok || !res.receipt) {
        toast.error(res?.error || "Failed to load receipt");
        return;
      }
      const receiptData: ReceiptData = {
        ...res.receipt,
        date: new Date(res.receipt.date),
      };
      setDuplicateReceipt(receiptData);
      setDuplicatePrint(false);
      setTimeout(() => setDuplicatePrint(true), 120);
    } finally {
      setPrintingId(null);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={duplicateReceipt ? undefined : onClose}
      />
      <div className="relative z-10 w-full max-w-4xl rounded-xl bg-background border border-border shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Today&apos;s Orders
              </h2>
              <p className="text-xs text-muted-foreground">
                {orders.length} invoice{orders.length !== 1 ? "s" : ""}{" "}
                completed during this shift
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/40 text-muted-foreground">
                <ClipboardCheck className="h-8 w-8" />
              </div>
              <p className="font-medium text-foreground">
                No orders yet this shift
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Processed invoices from this counter shift will appear here.
              </p>
            </div>
          ) : (
            <div className="p-4">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-left px-3 py-2 font-medium">
                      Invoice #
                    </th>
                    <th className="text-left px-3 py-2 font-medium">Time</th>
                    <th className="text-left px-3 py-2 font-medium">Customer</th>
                    <th className="text-center px-3 py-2 font-medium">Items</th>
                    <th className="text-right px-3 py-2 font-medium">Total</th>
                    <th className="text-right px-3 py-2 font-medium">Paid</th>
                    <th className="px-3 py-2 font-medium text-left">Status</th>
                    <th className="px-3 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {orders.map((inv) => (
                    <tr
                      key={inv.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-3 py-3 font-medium text-minia-primary align-top whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <ReceiptIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          {inv.invoiceNumber}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground align-top whitespace-nowrap">
                        {fmtTime(inv.date)}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="text-sm text-foreground truncate max-w-[220px]">
                          {inv.customerName}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center text-sm text-foreground align-top font-semibold">
                        {inv.itemsCount || 0}
                      </td>
                      <td className="px-3 py-3 text-right align-top whitespace-nowrap">
                        <div className="text-sm font-semibold text-foreground">
                          {fmt(inv.grandTotal)}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right align-top whitespace-nowrap">
                        <div className="text-sm text-emerald-700 font-medium">
                          {fmt(inv.paidAmount)}
                        </div>
                        {inv.isCredit &&
                          Number(inv.grandTotal) - Number(inv.paidAmount) >
                            0.001 && (
                            <div className="text-[11px] text-amber-700">
                              Balance:{" "}
                              {fmt(
                                Number(inv.grandTotal) - Number(inv.paidAmount),
                              )}
                            </div>
                          )}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {inv.isCredit ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
                            Credit
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Paid
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            onClick={() => handlePrintSlip(inv)}
                            disabled={printingId === inv.id}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-border bg-background hover:bg-accent text-foreground transition-colors disabled:opacity-60"
                            title="Print duplicate receipt"
                          >
                            {printingId === inv.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Printer className="h-4 w-4" />
                            )}
                          </button>
                          {canRefund && inv.status !== "CANCELLED" && (
                            <button
                              onClick={async () => {
                                if (!onRefundInvoice) return;
                                setPrintingId(inv.id + "__r");
                                try {
                                  const res: any = await getInvoiceReceiptDuplicateClient(inv.id);
                                  let items: RefundTargetInvoice["items"] = [];
                                  let payments: RefundTargetInvoice["payments"] = [];
                                  if (res?.ok && res?.receipt) {
                                    items = (res.receipt.lines || []).map((rl: any, i: number) => ({
                                      id: `${inv.id}-rl-${i}`,
                                      description: rl.description,
                                      quantity: Number(rl.quantity || 1),
                                      unitPrice: Number(rl.unitPrice || 0),
                                      discount: rl.discount ? Number(rl.discount) : 0,
                                      amount: Number(rl.amount || 0),
                                      batchNumber: rl.batchNumber || null,
                                      expiryDate: rl.expiryDate || null,
                                    }));
                                    payments = (res.receipt.payments || []).map((p: any) => ({
                                      method: p.method,
                                      amount: Number(p.amount || 0),
                                      reference: p.reference,
                                    }));
                                  }
                                  onRefundInvoice({
                                    id: inv.id,
                                    invoiceNumber: inv.invoiceNumber,
                                    customerName: inv.customerName,
                                    date: inv.date,
                                    status: inv.status,
                                    subTotal: inv.grandTotal + (inv.isCredit ? 0 : 0),
                                    grandTotal: Number(inv.grandTotal || 0),
                                    paidAmount: Number(inv.paidAmount || 0),
                                    items,
                                    payments,
                                  });
                                } catch (err: any) {
                                  toast.error(err?.message || "Could not load invoice for refund");
                                } finally {
                                  setPrintingId(null);
                                }
                              }}
                              disabled={printingId === inv.id + "__r"}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 text-rose-600 transition-colors disabled:opacity-60"
                              title="Refund this invoice (Branch A)"
                            >
                              {printingId === inv.id + "__r" ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RotateCcw className="h-4 w-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {duplicateReceipt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => {
              setDuplicateReceipt(null);
              setDuplicatePrint(false);
            }}
          />
          <div className="relative z-10 w-full max-w-[92mm] rounded-xl bg-background border border-border shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Duplicate Receipt
                </h3>
                <p className="text-xs text-muted-foreground">
                  Invoice {duplicateReceipt.invoiceNumber}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDuplicatePrint(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background hover:bg-accent px-3 py-1.5 text-xs font-medium text-foreground transition-colors"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print
                </button>
                <button
                  onClick={() => {
                    setDuplicateReceipt(null);
                    setDuplicatePrint(false);
                  }}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto max-h-[75vh] bg-muted/30 p-3">
              <div className="rounded-lg border shadow bg-white">
                <Receipt
                  data={duplicateReceipt}
                  print={duplicatePrint}
                  onAfterPrint={() => setDuplicatePrint(false)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
