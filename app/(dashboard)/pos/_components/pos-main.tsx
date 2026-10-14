"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Store,
  Search,
  Clock,
  PanelLeftClose,
  PanelLeft,
  ClipboardList,
  ClipboardCheck,
  LogOut,
  Users,
  ArrowLeft,
  Maximize2,
  Minimize2,
  FileText,
  FileBarChart,
  RotateCcw,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { toastActionError } from "@/components/providers/toast";
import { useRouter } from "next/navigation";
import CategoriesPane from "./categories-pane";
import ItemGrid from "./item-grid";
import Cart, { type CartLine } from "./cart";
import CloseShiftModal from "./close-shift-modal";
import HoldOrdersModal, { type CartLine as HoldCartLine } from "./hold-orders-modal";
import TodaysOrdersModal from "./todays-orders-modal";
import CheckoutSheet from "./checkout-sheet";
import BatchPicker, { type ItemBatchRow } from "./batch-picker";
import POSReportModal, { type POSReportKind } from "./pos-report-modal";
import RefundDialog, { type RefundTargetInvoice } from "./refund-dialog";
import { saveHoldOrderClient, getHoldOrdersListClient, hasPermissionClient } from "../_actions_client";

interface POSItemShape {
  id: string;
  name: string;
  itemCode: string;
  unitName: string;
  stockQty: number;
  unitPrice: number;
  trackBatches?: boolean | null;
  hasExpiry?: boolean | null;
}

interface CustomerShape {
  id: string;
  name: string;
}

interface ShiftShape {
  id: string;
  posProfileId: string;
  shiftNumber?: string | null;
  counterName?: string | null;
  warehouseName?: string | null;
  billsCount?: number | null;
  openingFloat?: number | null;
  cashExpected?: number | null;
  cardExpected?: number | null;
  bankExpected?: number | null;
  walletExpected?: number | null;
  posProfile?: {
    id: string;
    name?: string | null;
    defaultCashAccountId?: string | null;
    defaultBankAccountId?: string | null;
    walkinCustomer?: { id: string; name: string } | null;
    receiptHeader?: string | null;
    receiptFooter?: string | null;
    posCounter?: { name: string } | null;
  } | null;
}

interface CompanySettingsShape {
  quickAmountRounding?: number | null;
  defaultCurrencyNotes?: number[] | null;
  baseCurrency?: string | null;
}

interface POSMainProps {
  initialShift: ShiftShape;
  initialCompanySettings: CompanySettingsShape | null;
}

const r2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export default function POSMain({ initialShift, initialCompanySettings }: POSMainProps) {
  const router = useRouter();
  const shift = initialShift;
  const companySettings = initialCompanySettings || {};
  const posProfileId = shift.posProfileId;
  const profile = shift.posProfile || { id: posProfileId };

  const walkin: CustomerShape = profile?.walkinCustomer
    ? { id: profile.walkinCustomer.id, name: profile.walkinCustomer.name }
    : { id: "walkin", name: "Walk-in Customer" };

  const [categoryId, setCategoryId] = useState<string>("all");
  const [categoriesCollapsed, setCategoriesCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [cartDiscount, setCartDiscount] = useState<number>(0);
  const [cartDiscountType, setCartDiscountType] = useState<"AMOUNT" | "PERCENT">("AMOUNT");
  const [customer, setCustomer] = useState<CustomerShape>(walkin);

  const [openCheckout, setOpenCheckout] = useState(false);
  const [isCreditCheckout, setIsCreditCheckout] = useState(false);
  const [loadedSavedOrderId, setLoadedSavedOrderId] = useState<string | null>(null);
  const [holdOrdersRefreshKey, setHoldOrdersRefreshKey] = useState(0);
  const [holdCount, setHoldCount] = useState(0);

  const [closeShiftOpen, setCloseShiftOpen] = useState(false);
  const [holdOrdersOpen, setHoldOrdersOpen] = useState(false);
  const [todaysOpen, setTodaysOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [batchPicker, setBatchPicker] = useState<{
    open: boolean;
    itemId: string | null;
    itemName: string | null;
    warehouseName: string | null;
    lineUid: string | null;
    requiredQty: number;
    allowBatch: boolean;
    allowExpiry: boolean;
  }>({
    open: false,
    itemId: null,
    itemName: null,
    warehouseName: null,
    lineUid: null,
    requiredQty: 1,
    allowBatch: false,
    allowExpiry: false,
  });

  const [reportOpen, setReportOpen] = useState<null | POSReportKind>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundInitialInvoice, setRefundInitialInvoice] =
    useState<RefundTargetInvoice | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({
    "pos.refund.do": false,
    "pos.report.xReport": false,
    "pos.report.zReport": false,
  });

  const [clockNow, setClockNow] = useState<Date>(new Date());

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setInterval(() => setClockNow(new Date()), 1000);
    const onFsChange = () => {
      const el: any = document;
      setIsFullscreen(Boolean(el.fullscreenElement || el.webkitFullscreenElement || el.mozFullScreenElement || el.msFullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    (document as any).addEventListener?.("webkitfullscreenchange", onFsChange);
    (document as any).addEventListener?.("mozfullscreenchange", onFsChange);
    (document as any).addEventListener?.("MSFullscreenChange", onFsChange);
    return () => {
      clearInterval(t);
      document.removeEventListener("fullscreenchange", onFsChange);
      (document as any).removeEventListener?.("webkitfullscreenchange", onFsChange);
      (document as any).removeEventListener?.("mozfullscreenchange", onFsChange);
      (document as any).removeEventListener?.("MSFullscreenChange", onFsChange);
    };
  }, []);

  async function toggleFullscreen() {
    try {
      const doc: any = document;
      const isFs = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);
      if (isFs) {
        const exit = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
        if (exit) await exit.call(doc);
      } else {
        const el: any = document.documentElement;
        const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
        if (req) await req.call(el);
      }
    } catch (err: any) {
      toast.error(err?.message || "Fullscreen unavailable");
    }
  }

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 200);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [r, x, z] = await Promise.all([
        hasPermissionClient("pos.refund.do"),
        hasPermissionClient("pos.report.xReport"),
        hasPermissionClient("pos.report.zReport"),
      ]);
      if (!active) return;
      setPermissions({
        "pos.refund.do": Boolean(r),
        "pos.report.xReport": Boolean(x),
        "pos.report.zReport": Boolean(z),
      });
    })().catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    getHoldOrdersListClient(posProfileId)
      .then((data: any) => {
        if (active) setHoldCount(Array.isArray(data) ? data.length : 0);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [posProfileId, holdOrdersRefreshKey, openCheckout]);

  const subtotal = useMemo(
    () => cartLines.reduce((s, l) => s + r2(l.quantity * l.unitPrice), 0),
    [cartLines]
  );
  const lineDiscounts = useMemo(
    () => cartLines.reduce((s, l) => s + r2(l.discount || 0), 0),
    [cartLines]
  );
  const cartDiscountAmount = useMemo(() => {
    if (cartDiscountType === "AMOUNT") return r2(Math.max(0, Math.min(cartDiscount, subtotal)));
    return r2(Math.max(0, Math.min(cartDiscount, 100)) * subtotal / 100);
  }, [cartDiscountType, cartDiscount, subtotal]);
  const discountTotal = useMemo(() => r2(lineDiscounts + cartDiscountAmount), [
    lineDiscounts,
    cartDiscountAmount,
  ]);
  const grandTotal = useMemo(() => Math.max(0, r2(subtotal - discountTotal)), [
    subtotal,
    discountTotal,
  ]);

  function handleAddToCart(item: POSItemShape) {
    const needsBatch = Boolean(item.trackBatches);
    const needsExpiry = Boolean(item.hasExpiry);
    const uid = `l-${item.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newLine: CartLine = {
      uid,
      itemId: item.id,
      itemName: item.name,
      itemCode: item.itemCode,
      unitName: item.unitName,
      quantity: 1,
      unitPrice: item.unitPrice,
      discount: 0,
      warehouseName: shift.warehouseName || null,
      needsBatchPick: needsBatch,
      needsExpiryPick: needsExpiry,
    };
    setCartLines((prev) => {
      const existing = prev.find((l) => l.itemId === item.id && !l.needsBatchPick && !l.needsExpiryPick && !l.batchNumber);
      if (existing && !needsBatch && !needsExpiry) {
        return prev.map((l) =>
          l.uid === existing.uid ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [...prev, newLine];
    });
    if (needsBatch || needsExpiry) {
      setTimeout(() => {
        setBatchPicker({
          open: true,
          itemId: item.id,
          itemName: item.name,
          warehouseName: shift.warehouseName || null,
          lineUid: uid,
          requiredQty: 1,
          allowBatch: needsBatch,
          allowExpiry: needsExpiry,
        });
      }, 30);
    }
  }

  function handleUpdateQty(uid: string, qty: number) {
    const next = Math.max(1, Math.round(qty || 1));
    setCartLines((prev) =>
      prev.map((l) => (l.uid === uid ? { ...l, quantity: next } : l))
    );
  }

  function handleRemove(uid: string) {
    setCartLines((prev) => prev.filter((l) => l.uid !== uid));
  }

  function handleLineDiscount(uid: string, discount: number) {
    setCartLines((prev) =>
      prev.map((l) => {
        if (l.uid !== uid) return l;
        const maxLine = r2(l.quantity * l.unitPrice);
        const d = Math.max(0, Math.min(Number(discount) || 0, maxLine));
        return { ...l, discount: d };
      })
    );
  }

  function handleCartDiscountChange(val: number, type?: "AMOUNT" | "PERCENT") {
    if (type) setCartDiscountType(type);
    const useType = type || cartDiscountType;
    const num = Number(val) || 0;
    const d = Math.max(0, useType === "PERCENT" ? Math.min(num, 100) : Math.min(num, subtotal));
    setCartDiscount(d);
  }

  function handleClearCart() {
    setCartLines([]);
    setCartDiscount(0);
    setLoadedSavedOrderId(null);
  }

  async function handleSaveOrder() {
    if (cartLines.length === 0) return;
    const itemsJson = cartLines.map((l) => ({
      itemId: l.itemId,
      itemName: l.itemName,
      itemCode: l.itemCode,
      unitName: l.unitName,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discount: l.discount,
      warehouseName: l.warehouseName,
    }));
    const totalsJson = {
      subtotal,
      lineDiscounts,
      cartDiscount: cartDiscountAmount,
      cartDiscountType,
      cartDiscountInputValue: cartDiscount,
      discountTotal,
      grandTotal,
    };
    try {
      const res: any = await saveHoldOrderClient({
        posProfileId,
        itemsJson,
        totalsJson,
        customerId: customer.id,
        existingId: loadedSavedOrderId || undefined,
      });
      if (res && typeof res === "object" && "ok" in res && res.ok === false) {
        toastActionError(res, { fallback: "Failed to save order" });
        return;
      }
      toast.success("Order saved");
      setCartLines([]);
      setCartDiscount(0);
      setLoadedSavedOrderId(null);
      setCustomer(walkin);
      setHoldOrdersRefreshKey((k) => k + 1);
    } catch (err: any) {
      toastActionError(err, { fallback: "Failed to save order" });
    }
  }

  function handleCheckout() {
    if (cartLines.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    const pendingBatch = cartLines.find((l) => l.needsBatchPick || l.needsExpiryPick);
    if (pendingBatch) {
      toast.error(`Select batch/expiry for "${pendingBatch.itemName}" before checkout`);
      handlePickBatchForLine(pendingBatch.uid);
      return;
    }
    setIsCreditCheckout(false);
    setOpenCheckout(true);
  }

  function handleCreditCheckout() {
    if (cartLines.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    if (customer.id === walkin.id) {
      toast.error("Please select a registered customer (not walk-in) for credit checkout");
      return;
    }
    const pendingBatch = cartLines.find((l) => l.needsBatchPick || l.needsExpiryPick);
    if (pendingBatch) {
      toast.error(`Select batch/expiry for "${pendingBatch.itemName}" before checkout`);
      handlePickBatchForLine(pendingBatch.uid);
      return;
    }
    setIsCreditCheckout(true);
    setOpenCheckout(true);
  }

  function handlePickBatchForLine(uid: string) {
    const line = cartLines.find((l) => l.uid === uid);
    if (!line) return;
    setBatchPicker({
      open: true,
      itemId: line.itemId,
      itemName: line.itemName,
      warehouseName: line.warehouseName || null,
      lineUid: uid,
      requiredQty: line.quantity,
      allowBatch: Boolean(line.needsBatchPick) || Boolean(line.batchNumber) || true,
      allowExpiry: Boolean(line.needsExpiryPick) || Boolean(line.expiryDate) || true,
    });
  }

  function handleConfirmBatch(picked: ItemBatchRow | null, qty: number) {
    if (!picked || !batchPicker.lineUid) {
      setBatchPicker((prev) => ({ ...prev, open: false }));
      return;
    }
    const uid = batchPicker.lineUid;
    setCartLines((prev) =>
      prev.map((l) => {
        if (l.uid !== uid) return l;
        const nextQty = Math.max(1, qty);
        return {
          ...l,
          quantity: nextQty,
          batchNumber: picked.batchNumber,
          expiryDate: picked.expiryDate ? new Date(picked.expiryDate).toISOString() : null,
          itemBatchId: picked.id,
          warehouseName: picked.warehouseName || l.warehouseName,
          needsBatchPick: false,
          needsExpiryPick: false,
        };
      })
    );
    setBatchPicker((prev) => ({ ...prev, open: false }));
  }

  function handleLoadSavedOrder(
    orderId: string,
    items: HoldCartLine[],
    cartDisc: number,
    customerId?: string,
    cartDiscType?: "AMOUNT" | "PERCENT",
    cartDiscInputValue?: number,
  ) {
    setCartLines((items as CartLine[]).map((l) => ({
      ...l,
      needsBatchPick: Boolean(l.needsBatchPick),
      needsExpiryPick: Boolean(l.needsExpiryPick),
    })));
    if (cartDiscType) setCartDiscountType(cartDiscType);
    setCartDiscount(cartDiscInputValue != null ? cartDiscInputValue : cartDisc);
    setLoadedSavedOrderId(orderId);
    if (customerId) {
      setCustomer((prev) =>
        prev.id === customerId ? prev : { id: customerId, name: prev.name }
      );
    }
    setHoldOrdersRefreshKey((k) => k + 1);
  }

  const handleCheckoutComplete = useCallback(function handleCheckoutComplete(opts: { resetCart: boolean }) {
    setOpenCheckout(false);
    if (opts.resetCart) {
      setCartLines([]);
      setCartDiscount(0);
      setLoadedSavedOrderId(null);
      setCustomer(walkin);
    }
    setHoldOrdersRefreshKey((k) => k + 1);
  }, [walkin]);

  const pad = (n: number) => n.toString().padStart(2, "0");
  const clockStr = `${pad(clockNow.getHours())}:${pad(clockNow.getMinutes())}:${pad(clockNow.getSeconds())}`;

  const shiftProfile: any = {
    ...profile,
    id: profile?.id || posProfileId,
    defaultCashAccountId: profile?.defaultCashAccountId || undefined,
    defaultBankAccountId: profile?.defaultBankAccountId || undefined,
    walkinCustomer: profile?.walkinCustomer || undefined,
    receiptHeader: profile?.receiptHeader || undefined,
    receiptFooter: profile?.receiptFooter || undefined,
    posCounter: profile?.posCounter || undefined,
  };

  return (
    <div className="fixed inset-0 z-40 bg-background flex flex-col h-screen overflow-hidden">
      <div className="h-[60px] shrink-0 flex items-center gap-3 px-4 border-b border-border bg-card/80 backdrop-blur">
        <button
          onClick={() => router.push("/")}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border hover:bg-accent/60 text-sm font-medium text-foreground transition-colors"
          title="Back to Dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Dashboard</span>
        </button>

        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-minia-primary/15 text-minia-primary">
            <Store className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-bold text-foreground">POS</span>
              <span className="text-xs text-muted-foreground truncate">
                {shift.counterName || profile?.posCounter?.name || "Counter"}
              </span>
              {shift.shiftNumber && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                  {shift.shiftNumber}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => setHoldOrdersOpen(true)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-accent/60 text-sm font-medium text-foreground transition-colors"
        >
          <ClipboardList className="h-4 w-4" />
          <span className="hidden sm:inline">Active Orders</span>
          <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 text-xs font-bold">
            {holdCount}
          </span>
        </button>

        <button
          onClick={() => setTodaysOpen(true)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-accent/60 text-sm font-medium text-foreground transition-colors"
        >
          <ClipboardCheck className="h-4 w-4" />
          <span className="hidden md:inline">Today&apos;s Orders</span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 text-xs font-bold">
            {shift.billsCount || 0}
          </span>
        </button>

        <div className="flex-1 max-w-md mx-auto px-3">
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items or scan barcode..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-minia-primary/30 focus:border-minia-primary/40"
            />
          </div>
        </div>

        <div className="flex items-center gap-1 px-2 py-1 rounded-lg rounded-md text-muted-foreground font-mono text-sm">
          <Clock className="h-4 w-4 mr-1" />
          {clockStr}
        </div>

        {permissions["pos.report.xReport"] && (
          <button
            onClick={() => setReportOpen("X")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-500/40 bg-sky-500/5 text-sky-700 hover:bg-sky-500/10 text-sm font-medium transition-colors"
            title="Mid-Shift X Report"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">X Report</span>
          </button>
        )}
        {permissions["pos.report.zReport"] && (
          <button
            onClick={() => setReportOpen("Z")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-500/40 bg-violet-500/5 text-violet-700 hover:bg-violet-500/10 text-sm font-medium transition-colors"
            title="Close shift / generate Z Report"
          >
            <FileBarChart className="h-4 w-4" />
            <span className="hidden sm:inline">Z Report</span>
          </button>
        )}
        {permissions["pos.refund.do"] && (
          <button
            onClick={() => {
              setRefundInitialInvoice(null);
              setRefundOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/5 text-rose-700 hover:bg-rose-500/10 text-sm font-medium transition-colors"
            title="Issue POS Refund"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Refund</span>
          </button>
        )}

        <button
          onClick={toggleFullscreen}
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border hover:bg-accent/60 text-foreground transition-colors"
          title={isFullscreen ? "Exit full screen" : "Full screen"}
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>

        <button
          onClick={() => setCloseShiftOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors shadow-sm"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Close Register</span>
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden h-[calc(100vh-60px)]">
        <CategoriesPane
          profileId={posProfileId}
          selectedCategory={categoryId}
          onSelect={setCategoryId}
          collapsed={categoriesCollapsed}
          onToggleCollapse={() => setCategoriesCollapsed((c) => !c)}
        />

        {categoriesCollapsed && (
          <button
            onClick={() => setCategoriesCollapsed(false)}
            className="h-full w-8 shrink-0 flex items-center justify-center border-r border-border/60 bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
            title="Show categories"
          >
            <PanelLeft className="h-4 w-4 -rotate-180" />
          </button>
        )}

        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden">
            <ItemGrid
              profileId={posProfileId}
              categoryId={categoryId}
              query={debouncedQuery}
              onAddToCart={handleAddToCart}
            />
          </div>
        </div>

        <div className="w-[42%] md:w-[40%] lg:w-[36%] xl:w-[32%] 2xl:w-[28%] min-w-[340px] max-w-[540px] shrink-0 border-l border-border overflow-hidden flex flex-col">
          <Cart
            lines={cartLines}
            onUpdateQty={handleUpdateQty}
            onRemove={handleRemove}
            onDiscountLine={handleLineDiscount}
            onPickBatchForLine={handlePickBatchForLine}
            cartDiscount={cartDiscountAmount}
            cartDiscountInputValue={cartDiscount}
            cartDiscountType={cartDiscountType}
            onCartDiscountChange={handleCartDiscountChange}
            subtotal={subtotal}
            discountTotal={discountTotal}
            grandTotal={grandTotal}
            customer={customer}
            walkinCustomerId={walkin.id}
            onChangeCustomer={setCustomer}
            onSaveOrder={handleSaveOrder}
            onCheckout={handleCheckout}
            onCreditCheckout={handleCreditCheckout}
            onClearCart={handleClearCart}
          />
        </div>
      </div>

      <BatchPicker
        open={batchPicker.open}
        onClose={() => setBatchPicker((p) => ({ ...p, open: false }))}
        itemId={batchPicker.itemId}
        itemName={batchPicker.itemName}
        warehouseName={batchPicker.warehouseName}
        requiredQty={batchPicker.requiredQty}
        allowBatchPick={batchPicker.allowBatch}
        allowExpiryPick={batchPicker.allowExpiry}
        onConfirm={handleConfirmBatch}
      />

      <CloseShiftModal
        open={closeShiftOpen}
        onClose={() => setCloseShiftOpen(false)}
        shiftId={shift.id}
        expected={{
          cash: Number(shift.cashExpected || 0),
          card: Number(shift.cardExpected || 0),
          bank: Number(shift.bankExpected || 0),
          wallet: Number(shift.walletExpected || 0),
          openingFloat: Number(shift.openingFloat || 0),
        }}
      />

      <HoldOrdersModal
        open={holdOrdersOpen}
        onClose={() => setHoldOrdersOpen(false)}
        posProfileId={posProfileId}
        onLoadOrder={handleLoadSavedOrder}
        refreshKey={holdOrdersRefreshKey}
      />

      <TodaysOrdersModal
        open={todaysOpen}
        onClose={() => setTodaysOpen(false)}
        shiftId={shift.id}
        canRefund={permissions["pos.refund.do"]}
        onRefundInvoice={(inv) => {
          setRefundInitialInvoice(inv);
          setTodaysOpen(false);
          setRefundOpen(true);
        }}
      />

      <CheckoutSheet
        open={openCheckout}
        onClose={() => setOpenCheckout(false)}
        lines={cartLines}
        subtotal={subtotal}
        discountTotal={discountTotal}
        grandTotal={grandTotal}
        cartDiscount={cartDiscountAmount}
        customer={customer}
        profile={shiftProfile}
        shift={{
          id: shift.id,
          posProfileId,
          warehouseName: shift.warehouseName,
          counterName: shift.counterName,
          shiftNumber: shift.shiftNumber,
        }}
        companySettings={{
          quickAmountRounding: companySettings.quickAmountRounding,
          defaultCurrencyNotes: companySettings.defaultCurrencyNotes,
          baseCurrency: companySettings.baseCurrency || undefined,
        }}
        savedOrderId={loadedSavedOrderId}
        isCredit={isCreditCheckout}
        onComplete={handleCheckoutComplete}
      />

      <POSReportModal
        open={reportOpen === "X" || reportOpen === "Z"}
        onClose={() => setReportOpen(null)}
        kind={reportOpen || "X"}
      />

      <RefundDialog
        open={refundOpen}
        onClose={() => setRefundOpen(false)}
        initialInvoice={refundInitialInvoice}
        walkinCustomerId={walkin.id}
        defaultCashAccountId={profile?.defaultCashAccountId || null}
        defaultBankAccountId={profile?.defaultBankAccountId || null}
      />
    </div>
  );
}
