"use client";

import { useState } from "react";
import { X, Save, Sliders, Check } from "lucide-react";
import { type BarcodeLayoutInput } from "./actions";

interface LayoutEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLayout?: BarcodeLayoutInput | null;
  onSave: (layout: BarcodeLayoutInput) => Promise<void>;
}

export default function LayoutEditorModal({
  isOpen,
  onClose,
  initialLayout,
  onSave,
}: LayoutEditorModalProps) {
  const [formData, setFormData] = useState<BarcodeLayoutInput>(
    initialLayout || {
      name: "Custom 50x25mm Roll",
      isDefault: false,
      paperType: "ROLL",
      widthMm: 50,
      heightMm: 25,
      columnsCount: 1,
      rowsPerPage: 1,
      gapX: 0,
      gapY: 2,
      marginTop: 1,
      marginLeft: 1,
      showCompanyName: true,
      companyTitle: "",
      showItemName: true,
      showPrice: true,
      showUnit: true,
      showBarcodeText: true,
      showCategory: false,
      barcodeFormat: "CODE128",
      barcodeHeight: 9,
      fontSize: 9,
      textAlign: "center",
      currencySymbol: "Rs.",
      printerName: "",
    }
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError("Please provide a name for this layout.");
      return;
    }
    if (formData.widthMm <= 0 || formData.heightMm <= 0) {
      setError("Width and height must be greater than 0 mm.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSave(formData);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to save layout.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl overflow-hidden my-8">
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/40">
          <div className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-minia-primary" />
            <h2 className="text-base font-semibold text-foreground">
              {formData.id ? "Edit Sticker Layout Preset" : "Create New Sticker Layout Preset"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[calc(85vh-120px)] overflow-y-auto">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-sm text-red-600 font-medium">
              {error}
            </div>
          )}

          {/* Preset Name & Default */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
                Preset Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Standard 50x25mm Thermal Roll"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-minia-primary/30"
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="rounded border-input text-minia-primary focus:ring-minia-primary h-4 w-4"
                />
                <span className="text-sm font-medium text-foreground">Set as Default</span>
              </label>
            </div>
          </div>

          {/* Paper Type & Dimensions */}
          <div className="rounded-lg border border-border p-4 bg-muted/10 space-y-4">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              1. Physical Paper & Label Dimensions
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Paper Type</label>
                <select
                  value={formData.paperType}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      paperType: e.target.value as "ROLL" | "SHEET",
                      columnsCount: e.target.value === "ROLL" ? 1 : Math.max(2, formData.columnsCount),
                    })
                  }
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-minia-primary/30"
                >
                  <option value="ROLL">Continuous Thermal Roll (1 across)</option>
                  <option value="SHEET">Multi-Label Sheet (e.g. A4 / Letter)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Sticker Width (mm) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="10"
                  max="300"
                  step="0.5"
                  required
                  value={formData.widthMm}
                  onChange={(e) => setFormData({ ...formData, widthMm: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-minia-primary/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Sticker Height (mm) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="10"
                  max="300"
                  step="0.5"
                  required
                  value={formData.heightMm}
                  onChange={(e) => setFormData({ ...formData, heightMm: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-minia-primary/30"
                />
              </div>
            </div>

            {formData.paperType === "SHEET" && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border/60">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-foreground">Columns Across</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.columnsCount}
                    onChange={(e) => setFormData({ ...formData, columnsCount: parseInt(e.target.value) || 1 })}
                    className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-foreground">Rows Per Sheet</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={formData.rowsPerPage}
                    onChange={(e) => setFormData({ ...formData, rowsPerPage: parseInt(e.target.value) || 1 })}
                    className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-foreground">Horizontal Gap (mm)</label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    step="0.5"
                    value={formData.gapX}
                    onChange={(e) => setFormData({ ...formData, gapX: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-foreground">Vertical Gap (mm)</label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    step="0.5"
                    value={formData.gapY}
                    onChange={(e) => setFormData({ ...formData, gapY: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Barcode Format & Sizing */}
          <div className="rounded-lg border border-border p-4 bg-muted/10 space-y-4">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              2. Barcode Format & Rendering
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Barcode Symbology</label>
                <select
                  value={formData.barcodeFormat}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      barcodeFormat: e.target.value as "CODE128" | "EAN13" | "QR",
                    })
                  }
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-minia-primary/30"
                >
                  <option value="CODE128">Code 128 (Universal 1D)</option>
                  <option value="EAN13">EAN-13 / UPC</option>
                  <option value="QR">QR Code (2D)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Barcode Height (mm)</label>
                <input
                  type="number"
                  min="4"
                  max="60"
                  step="0.5"
                  value={formData.barcodeHeight}
                  onChange={(e) => setFormData({ ...formData, barcodeHeight: parseFloat(e.target.value) || 8 })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-minia-primary/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Text Alignment</label>
                <select
                  value={formData.textAlign}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      textAlign: e.target.value as "left" | "center" | "right",
                    })
                  }
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-minia-primary/30"
                >
                  <option value="center">Center</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
          </div>

          {/* Field Visibility Toggles */}
          <div className="rounded-lg border border-border p-4 bg-muted/10 space-y-3">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              3. Displayed Fields & Information
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-muted/30">
                <input
                  type="checkbox"
                  checked={formData.showCompanyName}
                  onChange={(e) => setFormData({ ...formData, showCompanyName: e.target.checked })}
                  className="rounded border-input text-minia-primary focus:ring-minia-primary h-4 w-4"
                />
                <span className="text-xs font-medium text-foreground">Store / Company Name</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-muted/30">
                <input
                  type="checkbox"
                  checked={formData.showItemName}
                  onChange={(e) => setFormData({ ...formData, showItemName: e.target.checked })}
                  className="rounded border-input text-minia-primary focus:ring-minia-primary h-4 w-4"
                />
                <span className="text-xs font-medium text-foreground">Item Name</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-muted/30">
                <input
                  type="checkbox"
                  checked={formData.showPrice}
                  onChange={(e) => setFormData({ ...formData, showPrice: e.target.checked })}
                  className="rounded border-input text-minia-primary focus:ring-minia-primary h-4 w-4"
                />
                <span className="text-xs font-medium text-foreground">Selling Price</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-muted/30">
                <input
                  type="checkbox"
                  checked={formData.showUnit}
                  onChange={(e) => setFormData({ ...formData, showUnit: e.target.checked })}
                  className="rounded border-input text-minia-primary focus:ring-minia-primary h-4 w-4"
                />
                <span className="text-xs font-medium text-foreground">Unit Name</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-muted/30">
                <input
                  type="checkbox"
                  checked={formData.showBarcodeText}
                  onChange={(e) => setFormData({ ...formData, showBarcodeText: e.target.checked })}
                  className="rounded border-input text-minia-primary focus:ring-minia-primary h-4 w-4"
                />
                <span className="text-xs font-medium text-foreground">Barcode Number</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-muted/30">
                <input
                  type="checkbox"
                  checked={formData.showCategory}
                  onChange={(e) => setFormData({ ...formData, showCategory: e.target.checked })}
                  className="rounded border-input text-minia-primary focus:ring-minia-primary h-4 w-4"
                />
                <span className="text-xs font-medium text-foreground">Category</span>
              </label>
            </div>

            {formData.showCompanyName && (
              <div className="pt-2">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Custom Header / Store Title (leave blank to use system company name)
                </label>
                <input
                  type="text"
                  value={formData.companyTitle || ""}
                  onChange={(e) => setFormData({ ...formData, companyTitle: e.target.value })}
                  placeholder="e.g. My Superstore"
                  className="w-full mt-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs"
                />
              </div>
            )}
          </div>

          {/* Target Printer Name (Optional Hardware Preference) */}
          <div className="rounded-lg border border-border p-4 bg-muted/10 space-y-2">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              4. Target OS Printer Name (Optional)
            </div>
            <p className="text-xs text-muted-foreground">
              Save your preferred printer driver queue name (e.g., &quot;Xprinter XP-365B&quot;, &quot;Zebra ZD220&quot;, &quot;TSC TE200&quot;).
              When printing, select this printer in the system print dialog.
            </p>
            <input
              type="text"
              value={formData.printerName || ""}
              onChange={(e) => setFormData({ ...formData, printerName: e.target.value })}
              placeholder="e.g. Xprinter XP-365B or USB Thermal Printer"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-minia-primary/30"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-lg border border-border hover:bg-accent text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-minia-primary hover:bg-minia-primary/90 text-white text-sm font-semibold shadow-sm transition-colors"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Preset"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

