"use client";

import { useState, useEffect } from "react";
import { X, Printer, CheckCircle2, AlertTriangle, FileCode, Sparkles, Download, Copy, Check, Zap, RefreshCw } from "lucide-react";
import StickerView, { type StickerData } from "./sticker-view";
import { type BarcodeLayoutInput, checkPrinterBridgeStatus, dispatchDirectTestPrintToBridge } from "./actions";
import { generateTSPLJob } from "@/lib/tsc-tspl";
import { toast } from "react-hot-toast";

interface TestPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  layout: BarcodeLayoutInput;
  companyName: string;
  onDispatchDriverPrint: (testSticker: StickerData) => void;
  bridgeStatus?: {
    online: boolean;
    printerName?: string;
    port?: string;
    foundInWindows?: boolean;
  } | null;
}

export default function TestPrintModal({
  isOpen,
  onClose,
  layout,
  companyName,
  onDispatchDriverPrint,
  bridgeStatus: initialBridgeStatus,
}: TestPrintModalProps) {
  const [activeTab, setActiveTab] = useState<"SOFTWARE" | "HARDWARE">("HARDWARE");
  const [copiedTSPL, setCopiedTSPL] = useState(false);
  const [isDirectPrinting, setIsDirectPrinting] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState(initialBridgeStatus);
  const [isCheckingBridge, setIsCheckingBridge] = useState(false);

  useEffect(() => {
    if (isOpen) {
      checkBridge();
    }
  }, [isOpen]);

  const checkBridge = async () => {
    setIsCheckingBridge(true);
    try {
      // 1. Try browser-direct to local bridge
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 1200);
      const res = await fetch("http://127.0.0.1:9190/status", { signal: controller.signal });
      clearTimeout(id);
      if (res.ok) {
        const data = await res.json();
        setBridgeStatus(data);
        setIsCheckingBridge(false);
        return;
      }
    } catch {
      // fallback to server action
    }

    try {
      const data = await checkPrinterBridgeStatus();
      setBridgeStatus(data as any);
    } catch {
      setBridgeStatus(null);
    } finally {
      setIsCheckingBridge(false);
    }
  };

  if (!isOpen) return null;

  const testStickerData: StickerData = {
    itemName: "1 KG Aata",
    unitName: "KG",
    sellingPrice: 120.0,
    barcode: "34567897666",
    category: "Grocery",
    isTest: false,
  };

  const cols = Math.max(1, layout.columnsCount || 1);

  const tsplOutput = generateTSPLJob(
    [
      {
        itemName: testStickerData.itemName,
        unitName: testStickerData.unitName,
        sellingPrice: testStickerData.sellingPrice,
        barcode: testStickerData.barcode,
        quantity: cols, // Fill 1 complete physical row (e.g. 3 across)
        companyTitle: layout.companyTitle || companyName || "Aujla Store",
      },
    ],
    {
      ...layout,
      heightMm: layout.heightMm ? Math.min(layout.heightMm, 18) : 18,
      gapX: layout.gapX || 2,
      gapY: layout.gapY || 3,
      marginLeft: layout.marginLeft || 2,
      marginTop: layout.marginTop || 2,
      companyTitle: layout.companyTitle || companyName || "Aujla Store",
    },
    { printerModel: "TSC TTP-244-Pro" }
  );

  const handleDownloadTSPL = () => {
    const blob = new Blob([tsplOutput], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tsc-ttp244-test-3up-${Date.now()}.prn`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Downloaded raw TSPL command file (.prn)");
  };

  const handleCopyTSPL = () => {
    navigator.clipboard.writeText(tsplOutput);
    setCopiedTSPL(true);
    setTimeout(() => setCopiedTSPL(false), 2000);
    toast.success("Copied TSPL command payload");
  };

  const handleDirectTestPrint = async () => {
    if (isDirectPrinting) return;
    setIsDirectPrinting(true);
    toast.loading("Sending 3-across test stickers to TSC TTP-244 Pro...", { id: "direct-test" });

    try {
      // 1. Try browser-direct to local bridge with generated 3-UP TSPL
      const res = await fetch("http://127.0.0.1:9190/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printerName: layout.printerName || "TSC TTP-244 Pro",
          tspl: tsplOutput,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          toast.success("Printed 3-across test stickers on TSC TTP-244 Pro!", { id: "direct-test" });
          setIsDirectPrinting(false);
          return;
        }
      }
    } catch {
      // fallback to server action
    }

    try {
      const result = await dispatchDirectTestPrintToBridge(layout.printerName || "TSC TTP-244 Pro");
      if (result.ok) {
        toast.success("Printed 3-across test stickers on TSC TTP-244 Pro!", { id: "direct-test" });
      } else {
        toast.error(result.error || "Failed to print test sticker", { id: "direct-test" });
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to reach printer bridge", { id: "direct-test" });
    } finally {
      setIsDirectPrinting(false);
    }
  };

  const handleCalibrateSensor = async () => {
    if (isCalibrating) return;
    setIsCalibrating(true);
    toast.loading("Sending sensor calibration to TSC TTP-244 Pro...", { id: "calibrate" });
    try {
      const res = await fetch("http://127.0.0.1:9190/calibrate", { method: "POST" });
      if (res.ok) {
        toast.success("Gap sensor calibration complete! Printer synchronized.", { id: "calibrate" });
        setIsCalibrating(false);
        return;
      }
    } catch {
      // fallback
    }
    toast.error("Could not reach printer bridge on port 9190.", { id: "calibrate" });
    setIsCalibrating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5 bg-muted/40">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-bold text-foreground">TSC TTP-244-Pro Test Print</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-border bg-muted/20 px-5 pt-2 gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("HARDWARE")}
            className={`pb-2 px-2 border-b-2 transition-colors ${
              activeTab === "HARDWARE"
                ? "border-minia-primary text-minia-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            1. Direct USB Test Print
          </button>
          <button
            onClick={() => setActiveTab("SOFTWARE")}
            className={`pb-2 px-2 border-b-2 transition-colors ${
              activeTab === "SOFTWARE"
                ? "border-minia-primary text-minia-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            2. Label Preview &amp; TSPL
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[calc(80vh-100px)] overflow-y-auto">
          {activeTab === "HARDWARE" ? (
            <div className="space-y-4">
              {/* Hardware Status Banner */}
              {bridgeStatus?.online ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      TSC TTP-244 Pro Connected
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-600 text-white font-mono font-bold tracking-wider">
                      {bridgeStatus.port || "USB002"} • ONLINE
                    </span>
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    The printer is connected via USB and recognized by the TradeFix Print Bridge. You can execute direct test prints instantly below.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      Checking Printer Connection...
                    </div>
                    <button
                      onClick={checkBridge}
                      className="p-1 rounded hover:bg-amber-500/20 text-amber-700 dark:text-amber-300"
                      title="Re-check printer"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isCheckingBridge ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    Ensure printer is powered on and connected via USB to port USB002.
                  </p>
                </div>
              )}

              {/* Direct Print Hero Action */}
              <div className="rounded-xl border border-border p-4 bg-muted/20 flex flex-col items-center justify-center text-center space-y-3">
                <div className="text-xs text-muted-foreground">
                  Prints 3 stickers across the 104mm label roll (each 32x25mm with 2mm gaps), centered with store title, item name, Code 128 barcode, and price matching the approved physical labels.
                </div>
                <button
                  onClick={handleDirectTestPrint}
                  disabled={isDirectPrinting}
                  className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold shadow-md transition-all disabled:opacity-50"
                >
                  <Zap className="h-4 w-4 fill-white" />
                  <span>{isDirectPrinting ? "Sending TSPL to Printer..." : "Direct Print 3-Across Test to TSC (Instant)"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCalibrateSensor}
                  disabled={isCalibrating}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-card hover:bg-accent text-xs font-semibold text-foreground transition-all disabled:opacity-50"
                  title="Feeds 2 labels to automatically detect gap and synchronize label alignment"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isCalibrating ? "animate-spin" : ""}`} />
                  <span>{isCalibrating ? "Calibrating..." : "Calibrate Gap Sensor (Sync Alignment)"}</span>
                </button>
              </div>

              {/* Secondary Option: Driver Print */}
              <div className="pt-2 border-t border-border flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  Alternative: Windows OS Print Spooler
                </span>
                <button
                  onClick={() => {
                    onDispatchDriverPrint(testStickerData);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-accent text-xs font-medium text-foreground transition-colors"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Dispatch via Driver</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Target Model:</span>
                <span className="font-bold text-foreground">TSC TTP-244-Pro (203 DPI) • 3-Across Roll</span>
              </div>

              {/* Live 3-Across Label Preview matching physical roll */}
              <div className="flex items-center justify-center gap-1.5 p-3 bg-muted/30 rounded-lg border border-border overflow-x-auto">
                {Array.from({ length: cols }).map((_, c) => (
                  <StickerView
                    key={c}
                    data={testStickerData}
                    layout={layout}
                    companyName={companyName}
                    scale={1.25}
                  />
                ))}
              </div>

              {/* Software Verification Status Grid */}
              <div className="rounded-lg border border-border p-3 bg-muted/15 space-y-2 text-xs">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Physical Geometry Validation:
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pl-5">
                  <div>• Label Size: {layout.widthMm} x {layout.heightMm} mm</div>
                  <div>• Roll Format: {cols} Labels Across (104mm total)</div>
                  <div>• Resolution: 203 DPI (8 dots/mm)</div>
                  <div>• Barcode Symbology: Code 128 (Centered)</div>
                </div>
              </div>

              {/* Raw TSPL Actions */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60">
                <button
                  onClick={handleCopyTSPL}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-accent text-xs font-medium text-foreground transition-colors"
                >
                  {copiedTSPL ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedTSPL ? "Copied" : "Copy TSPL"}</span>
                </button>

                <button
                  onClick={handleDownloadTSPL}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-accent text-xs font-medium text-foreground transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download TSPL (.prn)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

