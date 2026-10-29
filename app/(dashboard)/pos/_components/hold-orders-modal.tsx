"use client";

import { useEffect, useState } from "react";
import { X, ClipboardList, Loader2, Trash2, FolderOpen } from "lucide-react";
import { toast } from "react-hot-toast";
import {
  getHoldOrdersListClient,
  loadHoldOrderClient,
  deleteHoldOrderClient,
} from "../_actions_client";
import ConfirmDialog from "@/components/ui/confirm-dialog";

export interface CartLine {
  uid: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  unitName: string;
  conversionFactor?: number;
  quantity: number;
  unitPrice: number;
  discount: number;
  warehouseName: string | null;
}

interface HoldOrderSummary {
  id: string;
  orderKey: string;
  customerName: string;
  grandTotal: number;
  itemCount: number;
  updatedAt: Date;
}

interface HoldOrdersModalProps {
  open: boolean;
  onClose: () => void;
  posProfileId: string;
  onLoadOrder: (
    orderId: string,
    items: CartLine[],
    cartDiscount: number,
    customerId?: string,
    cartDiscType?: "AMOUNT" | "PERCENT",
    cartDiscInputValue?: number,
  ) => void;
  refreshKey: number;
}

const fmt = (n: number) => `Rs ${n.toFixed(2)}`;
const fmtTime = (d: Date) => {
  const date = new Date(d);
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

export default function HoldOrdersModal({
  open,
  onClose,
  posProfileId,
  onLoadOrder,
  refreshKey,
}: HoldOrdersModalProps) {
  const [orders, setOrders] = useState<HoldOrderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteName, setConfirmDeleteName] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    getHoldOrdersListClient(posProfileId)
      .then((data) => active && setOrders(data as HoldOrderSummary[]))
      .catch(() => active && setOrders([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [open, posProfileId, refreshKey]);

  const handleLoad = async (orderId: string) => {
    try {
      const order: any = await loadHoldOrderClient(orderId);
      const itemsArr = Array.isArray(order.itemsJson) ? order.itemsJson : [];
      const totals = order.totalsJson && typeof order.totalsJson === "object" ? order.totalsJson : {};
      const cartDiscount = Number(totals.cartDiscount || 0);
      const cartDiscType =
        totals.cartDiscountType === "AMOUNT" || totals.cartDiscountType === "PERCENT"
          ? totals.cartDiscountType
          : undefined;
      const cartDiscInputValue =
        totals.cartDiscountInputValue != null ? Number(totals.cartDiscountInputValue) : undefined;
      const lines: CartLine[] = itemsArr.map((raw: any, i: number) => ({
        uid: `${orderId}-${i}-${Date.now()}`,
        itemId: raw.itemId || "",
        itemName: raw.itemName || raw.name || "",
        itemCode: raw.itemCode || "",
        unitName: raw.unitName || "",
        quantity: Number(raw.quantity || 1),
        unitPrice: Number(raw.unitPrice || 0),
        discount: Number(raw.discount || 0),
        warehouseName: raw.warehouseName || null,
      }));
      onLoadOrder(
        orderId,
        lines,
        cartDiscount,
        order.customerId || undefined,
        cartDiscType,
        cartDiscInputValue
      );
      toast.success("Order loaded into cart");
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to load order");
    }
  };

  function askDelete(o: { id: string; orderKey: string; grandTotal: number }) {
    setConfirmDeleteId(o.id);
    setConfirmDeleteName(`${o.orderKey} (${fmt(o.grandTotal)})`);
  }

  const handleDelete = async () => {
    const id = confirmDeleteId;
    if (!id) return;
    setDeletingId(id);
    try {
      await deleteHoldOrderClient(id);
      setOrders((prev) => prev.filter((o) => o.id !== id));
      toast.success("Order deleted");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete");
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
      setConfirmDeleteName("");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-xl bg-background border border-border shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Active Saved Orders</h2>
              <p className="text-xs text-muted-foreground">
                {orders.length} order{orders.length !== 1 ? "s" : ""} on hold
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

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/40 text-muted-foreground">
                <ClipboardList className="h-8 w-8" />
              </div>
              <p className="font-medium text-foreground">No saved orders</p>
              <p className="text-sm text-muted-foreground mt-1">
                Saved orders will appear here when you use Save Order
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {orders.map((o) => (
                <div
                  key={o.id}
                  className="group flex items-center gap-3 rounded-lg border border-border p-3 hover:border-minia-primary/30 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                    <FolderOpen className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground text-sm">{o.orderKey}</span>
                      <span className="text-xs text-muted-foreground">{o.itemCount} items</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {o.customerName} &middot; {fmtTime(o.updatedAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-foreground">{fmt(o.grandTotal)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleLoad(o.id)}
                      className="px-3 py-1.5 rounded-md text-xs font-medium bg-minia-primary text-white hover:brightness-95 transition-colors"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => askDelete(o)}
                      disabled={Boolean(deletingId)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog
        isOpen={Boolean(confirmDeleteId)}
        onClose={() => {
          setConfirmDeleteId(null);
          setConfirmDeleteName("");
        }}
        onConfirm={handleDelete}
        title="Delete Saved Order?"
        message={`The saved order ${confirmDeleteName} will be permanently deleted. This cannot be undone.`}
        confirmText="Delete Order"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
}
