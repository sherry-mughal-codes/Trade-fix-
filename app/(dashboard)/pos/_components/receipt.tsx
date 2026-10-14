"use client";

import { useEffect } from "react";

export interface ReceiptLine {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  discount?: number;
  batchNumber?: string | null;
  expiryDate?: string | Date | null;
}

export interface ReceiptPayment {
  method: string;
  amount: number;
  reference?: string;
}

export interface ReceiptData {
  invoiceNumber: string;
  receiptHeader?: string | null;
  receiptFooter?: string | null;
  counterName?: string;
  cashierName?: string;
  customerName?: string;
  date: Date;
  lines: ReceiptLine[];
  subTotal: number;
  discountTotal: number;
  grandTotal: number;
  payments: ReceiptPayment[];
  change?: number;
  isCredit?: boolean;
}

interface ReceiptProps {
  data: ReceiptData;
  print?: boolean;
  onAfterPrint?: () => void;
}

const fmt = (n: number) => n.toFixed(2);
const pname = (m: string) => {
  const map: Record<string, string> = { CASH: "Cash", CARD: "Card", BANK: "Bank", WALLET: "Wallet", CREDIT: "Credit" };
  return map[m] || m;
};

export default function Receipt({ data, print, onAfterPrint }: ReceiptProps) {
  useEffect(() => {
    if (!print) return;
    let cancelled = false;
    const t = setTimeout(() => {
      if (!cancelled) {
        window.print();
        onAfterPrint?.();
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [print, onAfterPrint]);

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #receipt-root, #receipt-root * { visibility: visible !important; }
          #receipt-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          @page { size: 80mm auto; margin: 0; }
        }
      `}</style>
      <div
        id="receipt-root"
        className="w-[80mm] mx-auto bg-white text-black font-mono text-[12px] leading-tight p-3 space-y-2"
        style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace' }}
      >
        <div className="text-center space-y-0.5">
          {data.receiptHeader ? (
            data.receiptHeader.split("\n").map((l, i) => (
              <div key={i} className="font-bold text-sm whitespace-pre-wrap">
                {l || "\u00A0"}
              </div>
            ))
          ) : (
            <div className="font-bold text-sm">THANK YOU FOR YOUR PURCHASE</div>
          )}
        </div>

        <div className="border-t border-dashed border-black/40 my-1"></div>

        <div className="space-y-0.5">
          <div className="flex justify-between">
            <span>Invoice:</span>
            <span className="font-semibold">{data.invoiceNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>Date:</span>
            <span>
              {new Date(data.date).toLocaleDateString("en-GB")}{" "}
              {new Date(data.date).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>
          {data.counterName && (
            <div className="flex justify-between">
              <span>Counter:</span>
              <span>{data.counterName}</span>
            </div>
          )}
          {data.cashierName && (
            <div className="flex justify-between">
              <span>Cashier:</span>
              <span>{data.cashierName}</span>
            </div>
          )}
          {data.customerName && (
            <div className="flex justify-between">
              <span>Customer:</span>
              <span className="max-w-[30mm] truncate">{data.customerName}</span>
            </div>
          )}
        </div>

        <div className="border-t border-dashed border-black/40 my-1"></div>

        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="font-semibold border-b border-dotted border-black/30">
              <th className="text-left py-1">Item</th>
              <th className="text-right py-1">Qty</th>
              <th className="text-right py-1">Price</th>
              <th className="text-right py-1">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((l, i) => (
              <tr key={i} className="border-b border-dotted border-black/10 align-top">
                <td className="py-1 pr-1">
                  <div className="font-medium">{l.description}</div>
                  {(l.batchNumber || l.expiryDate) && (
                    <div className="text-[10px] text-black/70 leading-tight">
                      {l.batchNumber ? `Batch: ${l.batchNumber}` : null}
                      {l.expiryDate ? ` · Exp: ${new Date(l.expiryDate).toLocaleDateString("en-GB")}` : null}
                    </div>
                  )}
                  {l.discount ? (
                    <div className="text-red-600 text-[10px]">Disc {fmt(l.discount)}</div>
                  ) : null}
                </td>
                <td className="text-right py-1 whitespace-nowrap px-1">{l.quantity}</td>
                <td className="text-right py-1 whitespace-nowrap px-1">{fmt(l.unitPrice)}</td>
                <td className="text-right py-1 whitespace-nowrap font-medium">{fmt(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-dashed border-black/40 my-1"></div>

        <div className="space-y-0.5">
          <div className="flex justify-between text-[11px]">
            <span>Subtotal:</span>
            <span>{fmt(data.subTotal)}</span>
          </div>
          {data.discountTotal > 0 && (
            <div className="flex justify-between text-[11px] text-red-600">
              <span>Discount:</span>
              <span>-{fmt(data.discountTotal)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm pt-1 border-t border-dotted border-black/30">
            <span>GRAND TOTAL:</span>
            <span>{fmt(data.grandTotal)}</span>
          </div>
        </div>

        <div className="border-t border-dashed border-black/40 my-1"></div>

        <div className="space-y-0.5">
          {data.isCredit ? (
            <div className="flex justify-between font-semibold text-amber-700">
              <span>CREDIT - On Account</span>
              <span>{fmt(data.grandTotal)}</span>
            </div>
          ) : (
            data.payments.map((p, i) => (
              <div key={i} className="flex justify-between text-[11px]">
                <span>{pname(p.method)}{p.reference ? ` (${p.reference})` : ""}:</span>
                <span>{fmt(p.amount)}</span>
              </div>
            ))
          )}
          {typeof data.change === "number" && data.change > 0 && (
            <div className="flex justify-between text-[11px] text-emerald-700 font-semibold">
              <span>Change:</span>
              <span>{fmt(data.change)}</span>
            </div>
          )}
        </div>

        {data.receiptFooter && (
          <>
            <div className="border-t border-dashed border-black/40 my-1"></div>
            <div className="text-center whitespace-pre-wrap text-[11px]">
              {data.receiptFooter}
            </div>
          </>
        )}

        <div className="border-t border-dashed border-black/40 my-1"></div>
        <div className="text-center text-[11px] font-semibold pt-1">
          THANK YOU FOR YOUR PURCHASE!
        </div>
        <div className="text-center text-[10px] text-black/60">
          Please come again
        </div>
      </div>
    </>
  );
}
