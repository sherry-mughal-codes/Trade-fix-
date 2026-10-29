"use client";

import { useState, useEffect } from "react";
import { X, Save, Printer, Eye, Sliders, Check, Info, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { type BarcodeLayoutInput } from "./actions";
import StickerView from "./sticker-view";
import { parseAlignments, serializeAlignments, type TextAlignment, type ElementTextSize } from "@/lib/tsc-tspl";

interface PrinterSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  layout: BarcodeLayoutInput;
  onSave: (layout: BarcodeLayoutInput) => Promise<void>;
  installedPrinters?: string[];
  companyName?: string;
}

export default function PrinterSettingsModal({
  isOpen,
  onClose,
  layout,
  onSave,
  installedPrinters = [],
  companyName = "Store",
}: PrinterSettingsModalProps) {
  const initialAligns = parseAlignments(layout.textAlign);

  const [formData, setFormData] = useState<BarcodeLayoutInput & {
    companyAlign: TextAlignment;
    itemAlign: TextAlignment;
    barcodeAlign: TextAlignment;
    priceAlign: TextAlignment;
    companySize: ElementTextSize;
    itemSize: ElementTextSize;
    priceSize: ElementTextSize;
  }>({
    ...layout,
    printerName: layout.printerName || "TSC TTP-244 Pro",
    density: layout.density !== undefined ? layout.density : 10,
    speed: layout.speed !== undefined ? layout.speed : 3,
    sensorType: layout.sensorType || "GAP",
    marginLeft: layout.marginLeft !== undefined ? layout.marginLeft : 1.2,
    marginTop: layout.marginTop !== undefined ? layout.marginTop : 2.5,
    gapX: layout.gapX !== undefined ? layout.gapX : 1.5,
    gapY: layout.gapY !== undefined ? layout.gapY : 3.0,
    barcodeHeight: layout.barcodeHeight !== undefined ? layout.barcodeHeight : 4.0,
    companyAlign: initialAligns.companyAlign,
    itemAlign: initialAligns.itemAlign,
    barcodeAlign: initialAligns.barcodeAlign,
    priceAlign: initialAligns.priceAlign,
    companySize: initialAligns.companySize,
    itemSize: initialAligns.itemSize,
    priceSize: initialAligns.priceSize,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync form state whenever modal is opened with fresh layout data
  useEffect(() => {
    if (isOpen) {
      const aligns = parseAlignments(layout.textAlign);
      setFormData({
        ...layout,
        printerName: layout.printerName || "TSC TTP-244 Pro",
        density: layout.density !== undefined ? layout.density : 10,
        speed: layout.speed !== undefined ? layout.speed : 3,
        sensorType: layout.sensorType || "GAP",
        marginLeft: layout.marginLeft !== undefined ? layout.marginLeft : 1.2,
        marginTop: layout.marginTop !== undefined ? layout.marginTop : 2.5,
        gapX: layout.gapX !== undefined ? layout.gapX : 1.5,
        gapY: layout.gapY !== undefined ? layout.gapY : 3.0,
        barcodeHeight: layout.barcodeHeight !== undefined ? layout.barcodeHeight : 4.0,
        companyAlign: aligns.companyAlign,
        itemAlign: aligns.itemAlign,
        barcodeAlign: aligns.barcodeAlign,
        priceAlign: aligns.priceAlign,
        companySize: aligns.companySize,
        itemSize: aligns.itemSize,
        priceSize: aligns.priceSize,
      });
    }
  }, [isOpen, layout]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name?.trim()) {
      formData.name = "Custom Printer Settings";
    }
    if (formData.widthMm <= 0 || formData.heightMm <= 0) {
      setError("Width and height must be positive numbers in millimeters.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Serialize individual alignments and sizes into the authoritative textAlign string
      const serializedAlign = serializeAlignments({
        companyAlign: formData.companyAlign,
        itemAlign: formData.itemAlign,
        barcodeAlign: formData.barcodeAlign,
        priceAlign: formData.priceAlign,
        companySize: formData.companySize,
        itemSize: formData.itemSize,
        priceSize: formData.priceSize,
      });

      await onSave({
        ...formData,
        textAlign: serializedAlign,
        companyAlign: formData.companyAlign,
        itemAlign: formData.itemAlign,
        barcodeAlign: formData.barcodeAlign,
        priceAlign: formData.priceAlign,
        companySize: formData.companySize,
        itemSize: formData.itemSize,
        priceSize: formData.priceSize,
        printerName: formData.printerName || "TSC TTP-244 Pro",
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  // Sample data for real-time live preview inside settings
  const sampleData = {
    itemName: "Electrical Cable 90 Extra Heavy Duty",
    unitName: "MTR",
    sellingPrice: 6200,
    barcode: "ITM-DEMO-003",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-4xl rounded-xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-3.5 bg-muted/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-minia-primary/10 text-minia-primary flex items-center justify-center">
              <Printer className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Barcode &amp; Label Printer Settings</h2>
              <p className="text-[11px] text-muted-foreground">
                Configure printer driver, label dimensions, and text alignment positions.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body with Live Preview */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Left Side: Form Controls */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 max-h-[calc(90vh-130px)]">
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3.5 py-2 text-xs text-red-600 font-medium">
                {error}
              </div>
            )}

            {/* Section 1: Target Printer Hardware Configuration */}
            <div className="rounded-lg border border-border p-3.5 bg-muted/15 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                  Target Printer Driver
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 font-semibold border border-blue-500/20">
                  Thermal TSPL / 203 DPI
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[11px] font-medium text-foreground">
                    Selected Printer Name (Windows Spooler)
                  </label>
                  {installedPrinters.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={formData.printerName || installedPrinters[0]}
                        onChange={(e) => setFormData({ ...formData, printerName: e.target.value })}
                        className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-minia-primary/30"
                      >
                        {installedPrinters.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Custom Name"
                        value={formData.printerName || ""}
                        onChange={(e) => setFormData({ ...formData, printerName: e.target.value })}
                        className="w-36 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  ) : (
                    <input
                      type="text"
                      required
                      value={formData.printerName || "TSC TTP-244 Pro"}
                      onChange={(e) => setFormData({ ...formData, printerName: e.target.value })}
                      placeholder="e.g. TSC TTP-244 Pro, Xprinter, Zebra"
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-minia-primary/30"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-foreground">Media Sensor Type</label>
                  <select
                    value={formData.sensorType || "GAP"}
                    onChange={(e) => setFormData({ ...formData, sensorType: e.target.value as any })}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-minia-primary/30"
                  >
                    <option value="GAP">Gap / Die-cut (Default)</option>
                    <option value="BLACK_MARK">Black Mark</option>
                    <option value="CONTINUOUS">Continuous Paper</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-foreground">Print Speed</label>
                  <select
                    value={formData.speed !== undefined ? formData.speed : 3}
                    onChange={(e) => setFormData({ ...formData, speed: parseInt(e.target.value) || 3 })}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-minia-primary/30"
                  >
                    <option value={2}>2.0 ips (High Precision)</option>
                    <option value={3}>3.0 ips (Standard)</option>
                    <option value={4}>4.0 ips (High Speed)</option>
                  </select>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[11px] font-medium text-foreground">Darkness / Density</label>
                  <select
                    value={formData.density !== undefined ? formData.density : 10}
                    onChange={(e) => setFormData({ ...formData, density: parseInt(e.target.value) || 10 })}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-minia-primary/30"
                  >
                    <option value={4}>4 (Very Light)</option>
                    <option value={6}>6 (Light)</option>
                    <option value={8}>8 (Medium)</option>
                    <option value={10}>10 (Standard Dark)</option>
                    <option value={11}>11 (Darker)</option>
                    <option value={12}>12 (Extra Dark)</option>
                    <option value={13}>13 (Very Dark)</option>
                    <option value={14}>14 (High Density)</option>
                    <option value={15}>15 (Maximum Darkness)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Text Location, Alignment & Size Controls */}
            <div className="rounded-lg border border-border p-3.5 bg-muted/15 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                  Text Location &amp; Size Controls
                </span>
                <span className="text-[10px] text-muted-foreground">Adjust text size &amp; horizontal position</span>
              </div>

              <div className="space-y-2.5">
                {/* Store / Company Name */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg border border-border bg-card/60">
                  <span className="text-xs font-semibold text-foreground">Store / Company Name</span>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Size:</span>
                      <div className="inline-flex rounded-md border border-border bg-muted p-0.5">
                        {(["small", "normal", "large"] as ElementTextSize[]).map((size) => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => setFormData({ ...formData, companySize: size })}
                            className={`px-2 py-0.5 text-[10px] font-semibold rounded capitalize transition-colors ${
                              formData.companySize === size
                                ? "bg-minia-primary text-white shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Pos:</span>
                      <div className="inline-flex rounded-md border border-border bg-muted p-0.5">
                        {(["left", "center", "right"] as TextAlignment[]).map((align) => (
                          <button
                            key={align}
                            type="button"
                            onClick={() => setFormData({ ...formData, companyAlign: align })}
                            className={`px-2 py-0.5 text-[10px] font-semibold rounded capitalize transition-colors ${
                              formData.companyAlign === align
                                ? "bg-minia-primary text-white shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {align}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Item Name & Unit */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg border border-border bg-card/60">
                  <span className="text-xs font-semibold text-foreground">Item Name &amp; Unit</span>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Size:</span>
                      <div className="inline-flex rounded-md border border-border bg-muted p-0.5">
                        {(["small", "normal", "large"] as ElementTextSize[]).map((size) => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => setFormData({ ...formData, itemSize: size })}
                            className={`px-2 py-0.5 text-[10px] font-semibold rounded capitalize transition-colors ${
                              formData.itemSize === size
                                ? "bg-minia-primary text-white shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Pos:</span>
                      <div className="inline-flex rounded-md border border-border bg-muted p-0.5">
                        {(["left", "center", "right"] as TextAlignment[]).map((align) => (
                          <button
                            key={align}
                            type="button"
                            onClick={() => setFormData({ ...formData, itemAlign: align })}
                            className={`px-2 py-0.5 text-[10px] font-semibold rounded capitalize transition-colors ${
                              formData.itemAlign === align
                                ? "bg-minia-primary text-white shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {align}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Barcode & Number */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg border border-border bg-card/60">
                  <span className="text-xs font-semibold text-foreground">Barcode &amp; Number</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Pos:</span>
                    <div className="inline-flex rounded-md border border-border bg-muted p-0.5">
                      {(["left", "center", "right"] as TextAlignment[]).map((align) => (
                        <button
                          key={align}
                          type="button"
                          onClick={() => setFormData({ ...formData, barcodeAlign: align })}
                          className={`px-2 py-0.5 text-[10px] font-semibold rounded capitalize transition-colors ${
                            formData.barcodeAlign === align
                              ? "bg-minia-primary text-white shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {align}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Selling Price */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg border border-border bg-card/60">
                  <span className="text-xs font-semibold text-foreground">Selling Price</span>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Size:</span>
                      <div className="inline-flex rounded-md border border-border bg-muted p-0.5">
                        {(["small", "normal", "large"] as ElementTextSize[]).map((size) => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => setFormData({ ...formData, priceSize: size })}
                            className={`px-2 py-0.5 text-[10px] font-semibold rounded capitalize transition-colors ${
                              formData.priceSize === size
                                ? "bg-minia-primary text-white shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Pos:</span>
                      <div className="inline-flex rounded-md border border-border bg-muted p-0.5">
                        {(["left", "center", "right"] as TextAlignment[]).map((align) => (
                          <button
                            key={align}
                            type="button"
                            onClick={() => setFormData({ ...formData, priceAlign: align })}
                            className={`px-2 py-0.5 text-[10px] font-semibold rounded capitalize transition-colors ${
                              formData.priceAlign === align
                                ? "bg-minia-primary text-white shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {align}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Physical Label Roll Dimensions & Multi-Column Geometry */}
            <div className="rounded-lg border border-border p-3.5 bg-muted/15 space-y-3">
              <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                Physical Dimensions &amp; Margins
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-foreground">Sticker Width (mm)</label>
                  <input
                    type="number"
                    min="10"
                    max="110"
                    step="0.5"
                    required
                    value={formData.widthMm}
                    onChange={(e) => setFormData({ ...formData, widthMm: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-foreground">Sticker Height (mm)</label>
                  <input
                    type="number"
                    min="10"
                    max="300"
                    step="0.5"
                    required
                    value={formData.heightMm}
                    onChange={(e) => setFormData({ ...formData, heightMm: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-foreground">Columns Across</label>
                  <select
                    value={formData.columnsCount || 1}
                    onChange={(e) => setFormData({ ...formData, columnsCount: parseInt(e.target.value) || 1 })}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-minia-primary/30"
                  >
                    <option value={1}>1 Label Across</option>
                    <option value={2}>2 Labels Across</option>
                    <option value={3}>3 Labels Across (Standard 3-UP)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-foreground">Gap Between Columns (mm)</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={formData.gapX !== undefined ? formData.gapX : 1.5}
                    onChange={(e) => setFormData({ ...formData, gapX: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-foreground">Vertical Row Gap (mm)</label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    step="0.5"
                    value={formData.gapY !== undefined ? formData.gapY : 3.0}
                    onChange={(e) => setFormData({ ...formData, gapY: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-foreground">Left Margin Offset (mm)</label>
                  <input
                    type="number"
                    min="0"
                    max="15"
                    step="0.1"
                    value={formData.marginLeft !== undefined ? formData.marginLeft : 1.2}
                    onChange={(e) => setFormData({ ...formData, marginLeft: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-foreground">Top Margin Offset (mm)</label>
                  <input
                    type="number"
                    min="0.5"
                    max="15"
                    step="0.1"
                    value={formData.marginTop !== undefined ? formData.marginTop : 2.5}
                    onChange={(e) => setFormData({ ...formData, marginTop: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[11px] font-medium text-foreground">
                    Barcode Height (mm) — Symmetrically Scaled
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="30"
                    step="0.5"
                    required
                    value={formData.barcodeHeight !== undefined ? formData.barcodeHeight : 4.0}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({
                        ...formData,
                        barcodeHeight: val === "" ? (0 as any) : parseFloat(val) || 0,
                      });
                    }}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Information Printed on Sticker */}
            <div className="rounded-lg border border-border p-3.5 bg-muted/15 space-y-2.5">
              <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                Information Printed on Sticker
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-muted/40">
                  <input
                    type="checkbox"
                    checked={formData.showCompanyName}
                    onChange={(e) => setFormData({ ...formData, showCompanyName: e.target.checked })}
                    className="rounded border-input text-minia-primary focus:ring-minia-primary h-3.5 w-3.5"
                  />
                  <span className="text-xs font-medium text-foreground">Store Name</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-muted/40">
                  <input
                    type="checkbox"
                    checked={formData.showItemName}
                    onChange={(e) => setFormData({ ...formData, showItemName: e.target.checked })}
                    className="rounded border-input text-minia-primary focus:ring-minia-primary h-3.5 w-3.5"
                  />
                  <span className="text-xs font-medium text-foreground">Item Name</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-muted/40">
                  <input
                    type="checkbox"
                    checked={formData.showPrice}
                    onChange={(e) => setFormData({ ...formData, showPrice: e.target.checked })}
                    className="rounded border-input text-minia-primary focus:ring-minia-primary h-3.5 w-3.5"
                  />
                  <span className="text-xs font-medium text-foreground">Selling Price</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-muted/40">
                  <input
                    type="checkbox"
                    checked={formData.showUnit}
                    onChange={(e) => setFormData({ ...formData, showUnit: e.target.checked })}
                    className="rounded border-input text-minia-primary focus:ring-minia-primary h-3.5 w-3.5"
                  />
                  <span className="text-xs font-medium text-foreground">Unit Name</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-muted/40">
                  <input
                    type="checkbox"
                    checked={formData.showBarcodeText}
                    onChange={(e) => setFormData({ ...formData, showBarcodeText: e.target.checked })}
                    className="rounded border-input text-minia-primary focus:ring-minia-primary h-3.5 w-3.5"
                  />
                  <span className="text-xs font-medium text-foreground">Barcode Number</span>
                </label>
              </div>
            </div>
          </div>

          {/* Right Side: Instant Live Preview */}
          <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-border bg-muted/20 p-5 flex flex-col items-center justify-between shrink-0">
            <div className="w-full flex flex-col items-center">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground uppercase tracking-wide mb-3">
                <Eye className="h-4 w-4 text-minia-primary" />
                <span>Live Layout Preview</span>
              </div>
              <p className="text-[11px] text-muted-foreground text-center mb-4">
                Updates in real-time as you adjust alignment, barcode height, margins, or toggles.
              </p>

              <div className="p-3 bg-card rounded-xl border border-border shadow-md flex items-center justify-center">
                <StickerView
                  data={sampleData}
                  layout={formData}
                  companyName={companyName}
                  scale={2.2}
                />
              </div>

              <div className="mt-4 text-[10px] text-muted-foreground font-mono space-y-1 text-center w-full">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/70 border border-border font-sans font-semibold text-foreground text-[11px]">
                  <span>Darkness:</span>
                  <span className="font-mono text-minia-primary font-bold">{formData.density !== undefined ? formData.density : 10} / 15</span>
                  <span className="text-[10px] text-muted-foreground">
                    {(formData.density !== undefined ? formData.density : 10) <= 6
                      ? "(Light)"
                      : (formData.density !== undefined ? formData.density : 10) <= 10
                      ? "(Standard Bold)"
                      : "(Heavy Thermal Burn)"}
                  </span>
                </div>
                <div>
                  Size: {formData.widthMm} x {formData.heightMm} mm • Barcode: {formData.barcodeHeight || 4.0} mm
                </div>
                <div>Top Margin: {formData.marginTop || 2.5} mm</div>
                <div>
                  Pos: Store({formData.companyAlign}) • Item({formData.itemAlign}) • Price({formData.priceAlign})
                </div>
                <div>
                  Size: Store({formData.companySize}) • Item({formData.itemSize}) • Price({formData.priceSize})
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full flex items-center justify-end gap-2.5 pt-4 border-t border-border mt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-3.5 py-2 rounded-lg border border-border hover:bg-accent text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-minia-primary hover:bg-minia-primary/90 text-white text-xs font-bold shadow-sm"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
