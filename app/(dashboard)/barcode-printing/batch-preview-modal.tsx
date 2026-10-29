"use client";

import { useState } from "react";
import { X, Eye, Printer, FileDown } from "lucide-react";
import StickerView, { type StickerData } from "./sticker-view";
import { type BarcodeLayoutInput } from "./actions";

interface BatchPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  stickers: StickerData[];
  layout: BarcodeLayoutInput;
  companyName: string;
  onPrint: () => void;
  onExportPDF: () => void;
}

export default function BatchPreviewModal({
  isOpen,
  onClose,
  stickers,
  layout,
  companyName,
  onPrint,
  onExportPDF,
}: BatchPreviewModalProps) {
  const [zoom, setZoom] = useState(1.4);

  const cols = Math.max(1, layout.columnsCount || 1);

  // Group stickers into physical rows
  const rows: StickerData[][] = [];
  for (let i = 0; i < stickers.length; i += cols) {
    rows.push(stickers.slice(i, i + cols));
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-4xl rounded-xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-3.5 bg-muted/40 shrink-0">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-minia-primary" />
            <h2 className="text-sm font-bold text-foreground">
              Batch Sticker Preview ({stickers.length} stickers • {cols} per row)
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Zoom:</span>
              <button
                onClick={() => setZoom((z) => Math.max(0.8, z - 0.2))}
                className="h-6 w-6 rounded border border-border bg-background flex items-center justify-center font-bold"
              >
                -
              </button>
              <span className="font-mono px-1">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom((z) => Math.min(2.2, z + 0.2))}
                className="h-6 w-6 rounded border border-border bg-background flex items-center justify-center font-bold"
              >
                +
              </button>
            </div>

            <button
              onClick={onClose}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Physical Row Preview matching 3-up roll */}
        <div className="flex-1 overflow-y-auto p-6 bg-muted/20 space-y-4">
          {rows.map((rowItems, rIdx) => (
            <div
              key={rIdx}
              className="p-3 rounded-lg border border-border/80 bg-background/50 flex flex-col items-center gap-2"
            >
              <div className="w-full flex items-center justify-between text-[11px] text-muted-foreground px-1">
                <span className="font-semibold text-foreground">Row {rIdx + 1}</span>
                <span className="font-mono">
                  Labels #{rIdx * cols + 1} to #{Math.min(stickers.length, (rIdx + 1) * cols)}
                </span>
              </div>
              <div className="flex items-center justify-center gap-3 overflow-x-auto w-full py-1">
                {Array.from({ length: cols }).map((_, cIdx) => {
                  const stk = rowItems[cIdx];
                  return (
                    <div key={cIdx} className="flex flex-col items-center gap-1">
                      <span className="text-[9px] text-muted-foreground font-mono">
                        Col {cIdx + 1}
                      </span>
                      {stk ? (
                        <StickerView
                          data={stk}
                          layout={layout}
                          companyName={companyName}
                          scale={zoom}
                          className="shadow-sm"
                        />
                      ) : (
                        <div
                          style={{
                            width: `${layout.widthMm * 3.7795 * zoom}px`,
                            height: `${layout.heightMm * 3.7795 * zoom}px`,
                          }}
                          className="border border-dashed border-border rounded flex items-center justify-center text-[10px] text-muted-foreground/50 font-mono"
                        >
                          [Blank]
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-card flex items-center justify-between shrink-0">
          <div className="text-xs text-muted-foreground">
            Target Printer: <strong className="text-foreground">{layout.printerName || "Thermal Label Printer"}</strong> ({layout.widthMm}x{layout.heightMm}mm)
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onExportPDF}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-border hover:bg-accent text-xs font-semibold"
            >
              <FileDown className="h-4 w-4" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={() => {
                onClose();
                onPrint();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-minia-primary hover:bg-minia-primary/90 text-white text-xs font-bold shadow-sm"
            >
              <Printer className="h-4 w-4" />
              <span>Print All {stickers.length} Stickers</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

