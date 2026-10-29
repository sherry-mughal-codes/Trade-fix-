"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  Sliders,
  Eye,
  FileDown,
  Sparkles,
  AlertCircle,
  FileCode,
  Check,
  X,
  Layers,
  ArrowRight,
  Zap,
} from "lucide-react";
import { toast } from "react-hot-toast";
import {
  searchItemsForPrinting,
  saveBarcodeLayout,
  deleteBarcodeLayout,
  setDefaultBarcodeLayout,
  checkPrinterBridgeStatus,
  dispatchDirectPrintToBridge,
  type PrintableItem,
  type PrintableUnit,
  type BarcodeLayoutInput,
} from "./actions";
import PrinterSettingsModal from "./printer-settings-modal";
import TestPrintModal from "./test-print-modal";
import BatchPreviewModal from "./batch-preview-modal";
import PrintSheet from "./print-sheet";
import { exportStickersToPDF } from "./pdf-exporter";
import { generateTSPLJob } from "@/lib/tsc-tspl";

export interface BatchRow {
  rowId: string;
  item: PrintableItem;
  selectedUnit: PrintableUnit;
  quantity: number;
}

interface BarcodePrintingClientProps {
  initialLayouts: BarcodeLayoutInput[];
  categories: { id: string; name: string }[];
  companyName: string;
  baseCurrency: string;
}

export default function BarcodePrintingClient({
  initialLayouts,
  categories,
  companyName,
  baseCurrency,
}: BarcodePrintingClientProps) {
  // Layout Presets State (TSC TTP-244-Pro defaults)
  const [layouts, setLayouts] = useState<BarcodeLayoutInput[]>(initialLayouts);
  const activeDefault = useMemo(() => {
    return layouts.find((l) => l.isDefault) || layouts[0] || initialLayouts[0];
  }, [layouts, initialLayouts]);

  const [selectedLayoutId, setSelectedLayoutId] = useState<string>(activeDefault?.id || "");
  const currentLayout = useMemo(() => {
    return layouts.find((l) => l.id === selectedLayoutId) || activeDefault;
  }, [layouts, selectedLayoutId, activeDefault]);

  // Modals State
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [searchResults, setSearchResults] = useState<PrintableItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Batch Rows State
  const [batchRows, setBatchRows] = useState<BatchRow[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDirectPrintingBatch, setIsDirectPrintingBatch] = useState(false);
  const [testPrintSticker, setTestPrintSticker] = useState<any | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<{
    online: boolean;
    printerName?: string;
    installedPrinters?: string[];
    port?: string;
    foundInWindows?: boolean;
  } | null>(null);

  // Poll / Check bridge connectivity
  useEffect(() => {
    const checkBridge = async () => {
      try {
        const res = await fetch("http://127.0.0.1:9190/status");
        if (res.ok) {
          const d = await res.json();
          setBridgeStatus(d);
          return;
        }
      } catch {
        // fallback
      }

      try {
        const s = await checkPrinterBridgeStatus();
        if (s.ok) setBridgeStatus(s as any);
      } catch {}
    };

    checkBridge();
    const interval = setInterval(checkBridge, 10000);
    return () => clearInterval(interval);
  }, []);

  // Debounced search
  const performSearch = useCallback(async (q: string, cat: string) => {
    try {
      setIsSearching(true);
      const items = await searchItemsForPrinting({ query: q, categoryId: cat });
      setSearchResults(items);
      setShowDropdown(true);
    } catch (err: any) {
      toast.error(err?.message || "Failed to search items");
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!searchQuery.trim() && categoryId === "all") {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(searchQuery, categoryId);
    }, 200);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, categoryId, performSearch]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Add Item & Unit to Batch
  const handleAddToBatch = (item: PrintableItem, unit?: PrintableUnit) => {
    const selectedUnit = unit || item.units[0];
    const rowId = `batch-${item.id}-${selectedUnit.unitName}-${Date.now()}`;

    const existingIndex = batchRows.findIndex(
      (r) => r.item.id === item.id && r.selectedUnit.unitName === selectedUnit.unitName
    );

    if (existingIndex >= 0) {
      setBatchRows((prev) =>
        prev.map((r, i) => (i === existingIndex ? { ...r, quantity: r.quantity + 1 } : r))
      );
      toast.success(`Incremented quantity for ${item.name} (${selectedUnit.unitName})`);
    } else {
      setBatchRows((prev) => [
        ...prev,
        {
          rowId,
          item,
          selectedUnit,
          quantity: 1,
        },
      ]);
      toast.success(`Added ${item.name} (${selectedUnit.unitName})`);
    }
  };

  // Change Unit for Batch Row
  const handleChangeRowUnit = (rowId: string, unitName: string) => {
    setBatchRows((prev) =>
      prev.map((row) => {
        if (row.rowId !== rowId) return row;
        const newUnit = row.item.units.find((u) => u.unitName === unitName) || row.selectedUnit;
        return { ...row, selectedUnit: newUnit };
      })
    );
  };

  // Quantity updates
  const handleUpdateQuantity = (rowId: string, delta: number) => {
    setBatchRows((prev) =>
      prev.map((row) => {
        if (row.rowId !== rowId) return row;
        return { ...row, quantity: Math.max(1, row.quantity + delta) };
      })
    );
  };

  const handleSetExactQuantity = (rowId: string, qty: number) => {
    const val = Math.max(1, isNaN(qty) ? 1 : qty);
    setBatchRows((prev) =>
      prev.map((row) => (row.rowId === rowId ? { ...row, quantity: val } : row))
    );
  };

  // Remove Row
  const handleRemoveRow = (rowId: string) => {
    setBatchRows((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  // Clear Batch
  const handleClearBatch = () => {
    if (batchRows.length === 0) return;
    setBatchRows([]);
    toast.success("Batch cleared");
  };

  // Flattened Stickers for Preview and Print
  const flattenedStickers = useMemo(() => {
    const list: any[] = [];
    for (const row of batchRows) {
      for (let i = 0; i < row.quantity; i++) {
        list.push({
          itemName: row.item.name,
          unitName: row.selectedUnit.unitName,
          sellingPrice: row.selectedUnit.sellingPrice,
          barcode: row.selectedUnit.barcode,
          category: row.item.category,
          isTest: false,
        });
      }
    }
    return list;
  }, [batchRows]);

  const totalStickerCount = flattenedStickers.length;
  const invalidRowsCount = batchRows.filter((r) => !r.selectedUnit.hasValidBarcode).length;

  // Save Layout
  const handleSaveLayout = async (saved: BarcodeLayoutInput) => {
    const res = await saveBarcodeLayout(saved);
    if (res.ok && res.layout) {
      toast.success("Printer & layout settings saved");
      const nextList = layouts.map((l) => (l.id === res.layout.id ? (res.layout as BarcodeLayoutInput) : l));
      if (!layouts.some((l) => l.id === res.layout.id)) {
        nextList.push(res.layout as BarcodeLayoutInput);
      }
      setLayouts(nextList);
      setSelectedLayoutId(res.layout.id);
    } else {
      throw new Error(res.error || "Failed to save settings");
    }
  };

  // Direct Hardware Print to TSC TTP-244 Pro via Local Print Bridge
  const handleDirectPrintBatch = async () => {
    if (invalidRowsCount > 0) {
      toast.error(`Please remove or fix the ${invalidRowsCount} item(s) missing a barcode before printing.`);
      return;
    }
    if (batchRows.length === 0) {
      toast.error("Please add items to the batch before printing.");
      return;
    }

    if (isDirectPrintingBatch) return;
    const targetPrinter = bridgeStatus?.printerName || currentLayout.printerName || "Thermal Label Printer";
    setIsDirectPrintingBatch(true);
    toast.loading(`Printing ${totalStickerCount} stickers...`, { id: "direct-batch" });

    const tspl = generateTSPLJob(
      batchRows.map((r) => ({
        itemName: r.item.name,
        unitName: r.selectedUnit.unitName,
        sellingPrice: r.selectedUnit.sellingPrice,
        barcode: r.selectedUnit.barcode,
        quantity: r.quantity,
        companyTitle: currentLayout.companyTitle || companyName,
      })),
      {
        ...currentLayout,
        columnsCount: currentLayout.columnsCount || 3,
        widthMm: currentLayout.widthMm || 32,
        heightMm: currentLayout.heightMm || 18,
        gapX: currentLayout.gapX !== undefined ? currentLayout.gapX : 1.5,
        gapY: currentLayout.gapY !== undefined ? currentLayout.gapY : 3.0,
        marginLeft: currentLayout.marginLeft !== undefined ? currentLayout.marginLeft : 1.2,
        marginTop: currentLayout.marginTop !== undefined ? currentLayout.marginTop : 2.5,
        barcodeHeight: currentLayout.barcodeHeight !== undefined ? currentLayout.barcodeHeight : 4.0,
        textAlign: currentLayout.textAlign || "center",
        density: currentLayout.density !== undefined ? currentLayout.density : 10,
        speed: currentLayout.speed !== undefined ? currentLayout.speed : 3,
        sensorType: currentLayout.sensorType || "GAP",
        companyTitle: currentLayout.companyTitle || companyName,
      },
      { printerModel: targetPrinter }
    );

    try {
      // 1. Try client-direct to localhost:9190
      const res = await fetch("http://127.0.0.1:9190/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printerName: targetPrinter,
          tspl,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          toast.success(`Successfully printed ${totalStickerCount} stickers!`, { id: "direct-batch" });
          setIsDirectPrintingBatch(false);
          return;
        }
      }
    } catch {
      // fallback to server action
    }

    try {
      const res = await dispatchDirectPrintToBridge(tspl, targetPrinter);
      if (res.ok) {
        toast.success(`Successfully printed ${totalStickerCount} stickers!`, { id: "direct-batch" });
      } else {
        toast.error(res.error || "Failed to print stickers", { id: "direct-batch" });
      }
    } catch (err: any) {
      toast.error(err?.message || "Direct print failed", { id: "direct-batch" });
    } finally {
      setIsDirectPrintingBatch(false);
    }
  };

  // Dispatch Browser Print to OS Driver
  const handleExecutePrint = (testSticker?: any) => {
    if (invalidRowsCount > 0 && !testSticker) {
      toast.error(`Please remove or fix the ${invalidRowsCount} item(s) missing a barcode before printing.`);
      return;
    }
    if (flattenedStickers.length === 0 && !testSticker) {
      toast.error("Please add items to the batch before printing.");
      return;
    }

    if (isPrinting) return;
    setIsPrinting(true);

    if (testSticker) {
      setTestPrintSticker(testSticker);
    } else {
      setTestPrintSticker(null);
    }

    setTimeout(() => {
      window.print();
      setIsPrinting(false);
      const printer = currentLayout.printerName || "TSC TTP-244 Pro";
      toast.success(`Print dialog opened for ${printer}. Confirm in the system dialog.`);
    }, 150);
  };

  // Download Native TSPL Job File (.prn)
  const handleDownloadTSPLBatch = () => {
    if (batchRows.length === 0) {
      toast.error("No items in batch.");
      return;
    }
    const tspl = generateTSPLJob(
      batchRows.map((r) => ({
        itemName: r.item.name,
        unitName: r.selectedUnit.unitName,
        sellingPrice: r.selectedUnit.sellingPrice,
        barcode: r.selectedUnit.barcode,
        quantity: r.quantity,
        companyTitle: currentLayout.companyTitle || companyName,
      })),
      {
        ...currentLayout,
        columnsCount: currentLayout.columnsCount || 3,
        widthMm: currentLayout.widthMm || 32,
        heightMm: currentLayout.heightMm || 18,
        gapX: currentLayout.gapX !== undefined ? currentLayout.gapX : 1.5,
        gapY: currentLayout.gapY !== undefined ? currentLayout.gapY : 3.0,
        marginLeft: currentLayout.marginLeft !== undefined ? currentLayout.marginLeft : 1.2,
        marginTop: currentLayout.marginTop !== undefined ? currentLayout.marginTop : 2.5,
        barcodeHeight: currentLayout.barcodeHeight !== undefined ? currentLayout.barcodeHeight : 4.0,
        textAlign: currentLayout.textAlign || "center",
        density: currentLayout.density !== undefined ? currentLayout.density : 10,
        speed: currentLayout.speed !== undefined ? currentLayout.speed : 3,
        sensorType: currentLayout.sensorType || "GAP",
        companyTitle: currentLayout.companyTitle || companyName,
      },
      { printerModel: bridgeStatus?.printerName || currentLayout.printerName || "Thermal Label Printer" }
    );

    const blob = new Blob([tspl], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `label-batch-${Date.now()}.prn`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Downloaded label TSPL command file (.prn)");
  };

  // Download PDF
  const handleDownloadPDF = async () => {
    if (flattenedStickers.length === 0) {
      toast.error("No items in batch to export.");
      return;
    }
    try {
      toast.loading("Generating label PDF...", { id: "pdf-load" });
      await exportStickersToPDF(flattenedStickers, currentLayout, companyName);
      toast.success("PDF downloaded successfully!", { id: "pdf-load" });
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate PDF", { id: "pdf-load" });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-background">
      {/* Invisible Print Sheet Component for window.print() */}
      <PrintSheet
        stickers={testPrintSticker ? Array(currentLayout.columnsCount || 3).fill(testPrintSticker) : flattenedStickers}
        layout={currentLayout}
        companyName={companyName}
      />

      {/* Top Header */}
      <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-minia-primary/10 text-minia-primary flex items-center justify-center font-bold">
            <Printer className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground leading-tight">Barcode &amp; Sticker Printing</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Printer: <strong className="text-foreground">{bridgeStatus?.printerName || currentLayout.printerName || "Connected Label Printer"}</strong></span>
              <span>•</span>
              {bridgeStatus?.online ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Online ({bridgeStatus.port || "USB"})
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium">
                  Checking Printer...
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Bar (Printer Settings, Preview, Print) */}
        <div className="flex items-center gap-2">
          {/* Action: Printer Settings */}
          <button
            onClick={() => setSettingsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-accent text-xs font-semibold text-foreground transition-colors"
            title="Configure label dimensions, printer density, and speed"
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Printer Settings</span>
          </button>

          {/* Action: Preview */}
          <button
            onClick={() => setPreviewModalOpen(true)}
            disabled={flattenedStickers.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-accent text-xs font-semibold text-foreground transition-colors disabled:opacity-50"
            title="Preview all stickers before printing"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Preview ({totalStickerCount})</span>
          </button>

          {/* Action: Print */}
          <button
            onClick={handleDirectPrintBatch}
            disabled={flattenedStickers.length === 0 || isDirectPrintingBatch}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50"
            title="Print stickers directly to TSC printer"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>{isDirectPrintingBatch ? "Printing..." : totalStickerCount > 0 ? `Print (${totalStickerCount})` : "Print"}</span>
          </button>
        </div>
      </div>

      {/* Control Strip: 1. Item Search & 4. Layout Selector */}
      <div className="shrink-0 p-4 border-b border-border bg-card/60 flex flex-wrap items-center justify-between gap-3">
        {/* Search & Category Filter */}
        <div ref={searchContainerRef} className="relative flex-1 max-w-xl">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                placeholder="Search items by name or Item Code to add to batch..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-minia-primary/30"
              />
            </div>

            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-minia-primary/30"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Autocomplete Dropdown */}
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 rounded-lg border border-border bg-card shadow-xl z-30 max-h-64 overflow-y-auto divide-y divide-border/60">
              {searchResults.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 flex items-center justify-between gap-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-xs text-foreground truncate">{item.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Default: <span className="font-medium">{item.defaultUnit}</span> | Code:{" "}
                      <span className="font-mono">{item.itemCode || "None"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.units.map((u) => (
                      <button
                        key={u.unitName}
                        onClick={() => {
                          handleAddToBatch(item, u);
                          setShowDropdown(false);
                        }}
                        className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                          u.isDefault
                            ? "bg-minia-primary text-white hover:bg-minia-primary/90"
                            : "bg-muted text-foreground border border-border hover:bg-accent"
                        }`}
                        title={`Add ${item.name} (${u.unitName})`}
                      >
                        + {u.unitName}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Table: 2. Batch Table containing Selected Items, Units, and Quantities */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Queued Sticker Batch ({batchRows.length} items, {totalStickerCount} total stickers)
              </span>
              {invalidRowsCount > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-600 font-semibold border border-red-500/20">
                  {invalidRowsCount} missing barcode
                </span>
              )}
            </div>

            {batchRows.length > 0 && (
              <button
                onClick={handleClearBatch}
                className="text-xs text-red-600 hover:text-red-700 font-semibold transition-colors"
              >
                Clear Batch
              </button>
            )}
          </div>

          {batchRows.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center text-muted-foreground">
              <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center mb-3 text-muted-foreground">
                <Layers className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-foreground">No items in batch</p>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Type an item name or code in the search bar above to add items and alternate units to this print batch.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/10 text-muted-foreground font-semibold">
                  <th className="py-2.5 px-4 w-12">#</th>
                  <th className="py-2.5 px-4">Item Name / Code</th>
                  <th className="py-2.5 px-4 w-44">Unit</th>
                  <th className="py-2.5 px-4 w-40">Barcode</th>
                  <th className="py-2.5 px-4 w-32">Selling Price</th>
                  <th className="py-2.5 px-4 w-48 text-center">Sticker Quantity</th>
                  <th className="py-2.5 px-4 w-20 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {batchRows.map((row, idx) => (
                  <tr key={row.rowId} className="hover:bg-muted/10 transition-colors">
                    <td className="py-3 px-4 font-mono text-muted-foreground">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-foreground text-xs">{row.item.name}</div>
                      <div className="text-[11px] text-muted-foreground">{row.item.category || "Uncategorized"}</div>
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={row.selectedUnit.unitName}
                        onChange={(e) => handleChangeRowUnit(row.rowId, e.target.value)}
                        className="rounded border border-input bg-background px-2 py-1 text-xs font-semibold text-foreground"
                      >
                        {row.item.units.map((u) => (
                          <option key={u.unitName} value={u.unitName}>
                            {u.unitName} {u.isDefault ? "(Default)" : `(x${u.conversionFactor})`}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      {row.selectedUnit.hasValidBarcode ? (
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {row.selectedUnit.barcode}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-600 font-semibold text-[11px]">
                          <AlertCircle className="h-3.5 w-3.5" /> Missing
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-bold text-foreground">
                      {currentLayout.currencySymbol} {Number(row.selectedUnit.sellingPrice).toFixed(2)}
                    </td>
                    {/* 3. Sticker Quantity Field */}
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleUpdateQuantity(row.rowId, -1)}
                          className="h-7 w-7 rounded border border-border bg-background flex items-center justify-center hover:bg-accent font-bold"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          max="9999"
                          value={row.quantity}
                          onChange={(e) => handleSetExactQuantity(row.rowId, parseInt(e.target.value))}
                          className="w-16 text-center rounded border border-input bg-background py-1 text-xs font-bold"
                        />
                        <button
                          onClick={() => handleUpdateQuantity(row.rowId, 1)}
                          className="h-7 w-7 rounded border border-border bg-background flex items-center justify-center hover:bg-accent font-bold"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleUpdateQuantity(row.rowId, 10)}
                          className="px-2 py-1 rounded border border-border bg-muted text-[10px] font-semibold hover:bg-accent ml-1"
                        >
                          +10
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleRemoveRow(row.rowId)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-600 transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modals */}
      <PrinterSettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        layout={currentLayout}
        onSave={handleSaveLayout}
        installedPrinters={bridgeStatus?.installedPrinters}
        companyName={companyName}
      />

      <BatchPreviewModal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        stickers={flattenedStickers}
        layout={currentLayout}
        companyName={companyName}
        onPrint={() => handleDirectPrintBatch()}
        onExportPDF={handleDownloadPDF}
      />
    </div>
  );
}
