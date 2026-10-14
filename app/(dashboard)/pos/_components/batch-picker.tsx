"use client";

import { useEffect, useMemo, useState } from "react";
import { X as XIcon, Package, AlertTriangle } from "lucide-react";
import { toast } from "react-hot-toast";
import { fetchItemBatchesForPOSClient } from "../_actions_client";

export interface ItemBatchRow {
  id: string;
  batchNumber: string;
  availableQty: number;
  receivedDate: string | Date;
  expiryDate?: string | Date | null;
  warehouseName?: string | null;
  unitCost?: number | null;
}

interface BatchPickerProps {
  open: boolean;
  onClose: () => void;
  itemId: string | null;
  itemName?: string | null;
  warehouseName?: string | null;
  requiredQty: number;
  allowExpiryPick?: boolean;
  allowBatchPick?: boolean;
  onConfirm: (picked: ItemBatchRow | null, qty: number) => void;
}

const fmt = (n: number) => `Rs ${(Number(n) || 0).toFixed(2)}`;

function daysUntil(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const dayMs = 1000 * 60 * 60 * 24;
  return Math.ceil((d.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / dayMs);
}

export default function BatchPicker({
  open,
  onClose,
  itemId,
  itemName,
  warehouseName,
  requiredQty,
  allowBatchPick,
  allowExpiryPick,
  onConfirm,
}: BatchPickerProps) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ItemBatchRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickedQty, setPickedQty] = useState<number>(requiredQty || 1);

  useEffect(() => {
    if (!open || !itemId) return;
    setLoading(true);
    setSelectedId(null);
    setPickedQty(requiredQty > 0 ? requiredQty : 1);
    fetchItemBatchesForPOSClient(itemId, warehouseName || null)
      .then((data: any) => {
        const list: ItemBatchRow[] = Array.isArray(data) ? data : [];
        setRows(list);
        if (list.length > 0) {
          const firstOk = list.find((r) => Number(r.availableQty) >= requiredQty) || list[0];
          if (firstOk) setSelectedId(firstOk.id);
        }
      })
      .catch((err) => {
        toast.error(err?.message || "Could not load batches");
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [open, itemId, warehouseName, requiredQty]);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) || null, [rows, selectedId]);

  const canConfirm = selected && Number(selected.availableQty) >= pickedQty && pickedQty > 0;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-150 ${
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl mx-4 bg-background rounded-xl border border-border shadow-2xl max-h-[85vh] flex flex-col">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-600">
              <Package className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-foreground">
                Select batch {allowExpiryPick ? " & expiry" : ""}
              </div>
              <div className="text-xs text-muted-foreground truncate max-w-[420px]">
                {itemName || "Item"} • Required qty: {requiredQty}
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

        <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center gap-3">
          <label className="text-xs font-medium text-muted-foreground shrink-0">Qty from batch</label>
          <input
            type="number"
            min={1}
            value={pickedQty}
            onChange={(e) => setPickedQty(Math.max(1, Number(e.target.value) || 0))}
            className="w-24 rounded-md border border-input px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
          <span className="text-xs text-muted-foreground">
            Qty must be ≤ available in selected batch
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading batches…</div>
          ) : rows.length === 0 ? (
            <div className="py-12 px-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="text-sm font-medium text-foreground">No active batches with stock</div>
              <div className="text-xs text-muted-foreground mt-1">
                Cannot complete FMCG checkout for this item without an available batch.
              </div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background/95 backdrop-blur z-10 border-b border-border">
                <tr className="text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium w-8"></th>
                  <th className="text-left px-3 py-2 font-medium">Batch #</th>
                  <th className="text-left px-3 py-2 font-medium">Received</th>
                  <th className="text-left px-3 py-2 font-medium">Expiry</th>
                  <th className="text-left px-3 py-2 font-medium">Whse</th>
                  <th className="text-right px-4 py-2 font-medium">Available</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isSelected = r.id === selectedId;
                  const d = daysUntil(r.expiryDate);
                  const expSoon = d !== null && d <= 30;
                  const expired = d !== null && d < 0;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className={`cursor-pointer border-b border-border/50 transition-colors ${
                        isSelected
                          ? "bg-indigo-500/10"
                          : "hover:bg-muted/40"
                      }`}
                    >
                      <td className="px-4 py-2.5 align-top">
                        <input
                          type="radio"
                          checked={isSelected}
                          onChange={() => setSelectedId(r.id)}
                          className="accent-indigo-600"
                        />
                      </td>
                      <td className="px-3 py-2.5 align-top font-medium text-foreground">{r.batchNumber}</td>
                      <td className="px-3 py-2.5 align-top text-muted-foreground text-xs">
                        {r.receivedDate ? String(r.receivedDate).slice(0, 10) : "—"}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        {r.expiryDate ? (
                          <span
                            className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                              expired
                                ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                                : expSoon
                                ? "bg-amber-500/10 text-amber-700 border border-amber-500/20"
                                : "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                            }`}
                          >
                            {String(r.expiryDate).slice(0, 10)}
                            {d !== null && ` • ${d < 0 ? `${-d}d past` : `${d}d left`}`}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top text-muted-foreground text-xs">
                        {r.warehouseName || "—"}
                      </td>
                      <td className="px-4 py-2.5 align-top text-right font-semibold text-foreground">
                        {Number(r.availableQty || 0).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border bg-muted/10 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {selected ? (
              <>
                Picking <span className="font-semibold text-foreground">{pickedQty}</span> from{" "}
                <span className="font-semibold text-indigo-600">{selected.batchNumber}</span>
                {" • "}
                {selected.unitCost != null ? (
                  <span>Est. cost: {fmt(Number(selected.unitCost) * pickedQty)}</span>
                ) : null}
              </>
            ) : rows.length > 0 ? (
              "Pick a batch row"
            ) : (
              ""
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-md border border-border hover:bg-accent text-sm font-medium text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={!canConfirm}
              onClick={() => canConfirm && onConfirm(selected, pickedQty)}
              className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Confirm Batch
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
