"use client";

import { useMemo } from "react";
import { generateCode128SVG } from "@/lib/barcode-svg";
import { calculateStickerLayout, type TSPLLayoutConfig } from "@/lib/tsc-tspl";
import { type BarcodeLayoutInput } from "./actions";

export interface StickerData {
  itemName: string;
  unitName: string;
  sellingPrice: number;
  barcode: string;
  category?: string | null;
  isTest?: boolean;
}

interface StickerViewProps {
  data: StickerData;
  layout: BarcodeLayoutInput | TSPLLayoutConfig;
  companyName: string;
  scale?: number; // scale factor for UI preview
  className?: string;
}

export default function StickerView({
  data,
  layout,
  companyName,
  scale = 1,
  className = "",
}: StickerViewProps) {
  const companyTitle = ("companyTitle" in layout && layout.companyTitle?.trim()) || companyName;

  // Calculate layout geometry using the authoritative shared engine
  const stickerGeo = useMemo(() => {
    return calculateStickerLayout(
      {
        itemName: data.itemName,
        unitName: data.unitName,
        sellingPrice: data.sellingPrice,
        barcode: data.barcode,
        companyTitle,
      },
      layout as TSPLLayoutConfig,
      0 // column offset 0 for individual sticker preview
    );
  }, [data, layout, companyTitle]);

  const barcodeSvgHtml = useMemo(() => {
    if (!data.barcode || !stickerGeo.barcode) return "";
    return generateCode128SVG(data.barcode, {
      height: stickerGeo.barcode.heightDots,
      includeText: false,
    });
  }, [data.barcode, stickerGeo.barcode]);

  // Screen resolution conversion (1mm = 3.7795px at 96 DPI)
  const widthMm = layout.widthMm || 32;
  const heightMm = layout.heightMm || 18;
  const widthPx = widthMm * 3.7795 * scale;
  const heightPx = heightMm * 3.7795 * scale;

  // Dot-to-pixel ratio (203 DPI = 8 dots/mm)
  const pxPerDot = (widthMm * 3.7795 * scale) / stickerGeo.widthDots;

  // Visual simulation of printer darkness / density (4 to 15)
  const densityVal = Number(layout.density !== undefined ? layout.density : (stickerGeo.density || 10));
  
  const fontWeight =
    densityVal <= 6 ? 400 :
    densityVal <= 8 ? 600 :
    densityVal <= 10 ? 700 :
    densityVal <= 12 ? 800 : 900;

  const textOpacity =
    densityVal <= 4 ? 0.75 :
    densityVal <= 6 ? 0.85 :
    densityVal <= 8 ? 0.95 : 1;

  const textStroke =
    densityVal >= 14 ? "1.2px currentColor" :
    densityVal >= 12 ? "0.85px currentColor" :
    densityVal >= 10 ? "0.45px currentColor" :
    densityVal >= 8 ? "0.2px currentColor" : "0px";

  const textShadow =
    densityVal >= 14 ? "0 0 0.8px currentColor" :
    densityVal >= 12 ? "0 0 0.5px currentColor" :
    densityVal >= 10 ? "0 0 0.25px currentColor" : "none";

  const barcodeFilter =
    densityVal >= 14 ? "contrast(250%) drop-shadow(0 0 0.65px #000)" :
    densityVal >= 12 ? "contrast(180%) drop-shadow(0 0 0.35px #000)" :
    densityVal <= 4 ? "opacity(0.75)" :
    densityVal <= 6 ? "opacity(0.85)" : "none";

  const getAlignClass = (align?: string) => {
    if (align === "left") return "justify-start text-left";
    if (align === "right") return "justify-end text-right";
    return "justify-center text-center";
  };

  return (
    <div
      style={{
        width: `${widthPx}px`,
        height: `${heightPx}px`,
        minWidth: `${widthPx}px`,
        minHeight: `${heightPx}px`,
      }}
      className={`relative bg-white text-black border border-black/30 rounded-[2px] overflow-hidden select-none shadow-xs font-mono ${className}`}
    >
      {/* 1. Store / Company Name */}
      {stickerGeo.company && (
        <div
          style={{
            position: "absolute",
            left: `${stickerGeo.company.x * pxPerDot}px`,
            top: `${stickerGeo.company.y * pxPerDot}px`,
            width: `${stickerGeo.company.widthDots * pxPerDot}px`,
            height: `${stickerGeo.company.heightDots * pxPerDot}px`,
            fontSize: `${(stickerGeo.company.charHeightDots || 20) * pxPerDot * 0.85}px`,
            lineHeight: `${stickerGeo.company.heightDots * pxPerDot}px`,
            fontWeight,
            WebkitTextStroke: textStroke,
            textShadow,
            opacity: textOpacity,
          }}
          className={`truncate flex items-center text-black ${getAlignClass(stickerGeo.company.align)}`}
        >
          {stickerGeo.company.text}
        </div>
      )}

      {/* 2. Item Name & Unit */}
      {stickerGeo.item && (
        <div
          style={{
            position: "absolute",
            left: `${stickerGeo.item.x * pxPerDot}px`,
            top: `${stickerGeo.item.y * pxPerDot}px`,
            width: `${stickerGeo.item.widthDots * pxPerDot}px`,
            height: `${stickerGeo.item.heightDots * pxPerDot}px`,
            fontSize: `${(stickerGeo.item.charHeightDots || 16) * pxPerDot * 0.82}px`,
            lineHeight: `${stickerGeo.item.heightDots * pxPerDot}px`,
            fontWeight,
            WebkitTextStroke: textStroke,
            textShadow,
            opacity: textOpacity,
          }}
          className={`truncate flex items-center text-black ${getAlignClass(stickerGeo.item.align)}`}
        >
          {stickerGeo.item.text}
          {data.isTest && (
            <span className="ml-1 text-[0.65em] bg-amber-200 text-amber-900 px-0.5 rounded font-bold">
              TEST
            </span>
          )}
        </div>
      )}

      {/* 3. Barcode Vector Area */}
      {stickerGeo.barcode && (
        <div
          style={{
            position: "absolute",
            left: `${stickerGeo.barcode.x * pxPerDot}px`,
            top: `${stickerGeo.barcode.y * pxPerDot}px`,
            width: `${stickerGeo.barcode.widthDots * pxPerDot}px`,
            height: `${stickerGeo.barcode.heightDots * pxPerDot}px`,
            filter: barcodeFilter,
          }}
          className={`flex items-center overflow-hidden ${getAlignClass(stickerGeo.barcode.align)}`}
        >
          {barcodeSvgHtml ? (
            <div
              className="w-full h-full flex justify-center items-center [&>svg]:w-full [&>svg]:h-full"
              dangerouslySetInnerHTML={{ __html: barcodeSvgHtml }}
            />
          ) : (
            <div className="text-[10px] text-red-500 font-mono py-0.5 border border-dashed border-red-300 w-full text-center">
              [No Barcode]
            </div>
          )}
        </div>
      )}

      {/* 4. Human-Readable Barcode Text */}
      {stickerGeo.barcodeText && (
        <div
          style={{
            position: "absolute",
            left: `${stickerGeo.barcodeText.x * pxPerDot}px`,
            top: `${stickerGeo.barcodeText.y * pxPerDot}px`,
            width: `${stickerGeo.barcodeText.widthDots * pxPerDot}px`,
            height: `${stickerGeo.barcodeText.heightDots * pxPerDot}px`,
            fontSize: `${(stickerGeo.barcodeText.charHeightDots || 12) * pxPerDot * 0.85}px`,
            lineHeight: `${stickerGeo.barcodeText.heightDots * pxPerDot}px`,
            fontWeight,
            WebkitTextStroke: textStroke,
            textShadow,
            opacity: textOpacity,
          }}
          className={`font-mono tracking-wider text-black flex items-center ${getAlignClass(stickerGeo.barcodeText.align)}`}
        >
          {stickerGeo.barcodeText.text}
        </div>
      )}

      {/* 5. Selling Price */}
      {stickerGeo.price && (
        <div
          style={{
            position: "absolute",
            left: `${stickerGeo.price.x * pxPerDot}px`,
            top: `${stickerGeo.price.y * pxPerDot}px`,
            width: `${stickerGeo.price.widthDots * pxPerDot}px`,
            height: `${stickerGeo.price.heightDots * pxPerDot}px`,
            fontSize: `${(stickerGeo.price.charHeightDots || 20) * pxPerDot * 0.85}px`,
            lineHeight: `${stickerGeo.price.heightDots * pxPerDot}px`,
            fontWeight,
            WebkitTextStroke: textStroke,
            textShadow,
            opacity: textOpacity,
          }}
          className={`text-black flex items-center ${getAlignClass(stickerGeo.price.align)}`}
        >
          {stickerGeo.price.text}
        </div>
      )}
    </div>
  );
}
