"use client";

import { useMemo } from "react";
import StickerView, { type StickerData } from "./sticker-view";
import { type BarcodeLayoutInput } from "./actions";

interface PrintSheetProps {
  stickers: StickerData[];
  layout: BarcodeLayoutInput;
  companyName: string;
}

export default function PrintSheet({ stickers, layout, companyName }: PrintSheetProps) {
  const isRoll = layout.paperType === "ROLL";
  const { widthMm, heightMm, columnsCount, rowsPerPage, gapX = 2, gapY = 2, marginTop = 1, marginLeft = 2 } = layout;

  const cols = Math.max(1, columnsCount || 1);
  const totalRollWidthMm = cols > 1
    ? Math.round((marginLeft * 2) + (widthMm * cols) + (gapX * (cols - 1)))
    : widthMm;

  const pageSizeStyle = isRoll
    ? `@page { size: ${totalRollWidthMm}mm ${heightMm}mm; margin: 0; }`
    : `@page { size: A4 portrait; margin: ${marginTop}mm ${marginLeft}mm; }`;

  // Chunk stickers into rows for ROLL mode, or sheets for SHEET mode
  const rollRows = useMemo(() => {
    if (!isRoll) return [];
    const rows: StickerData[][] = [];
    for (let i = 0; i < stickers.length; i += cols) {
      rows.push(stickers.slice(i, i + cols));
    }
    return rows;
  }, [stickers, isRoll, cols]);

  const sheets = useMemo(() => {
    if (isRoll) return [];
    const perSheet = Math.max(1, cols * (rowsPerPage || 1));
    const result: StickerData[][] = [];
    for (let i = 0; i < stickers.length; i += perSheet) {
      result.push(stickers.slice(i, i + perSheet));
    }
    return result;
  }, [stickers, isRoll, cols, rowsPerPage]);

  return (
    <>
      <style>{`
        @media screen {
          #barcode-print-root {
            display: none !important;
          }
        }
        @media print {
          body * {
            visibility: hidden !important;
          }
          #barcode-print-root, #barcode-print-root * {
            visibility: visible !important;
          }
          #barcode-print-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .label-page-break {
            page-break-after: always !important;
            break-after: page !important;
          }
          ${pageSizeStyle}
        }
      `}</style>

      <div id="barcode-print-root">
        {isRoll ? (
          // Continuous Thermal Roll Mode (exact row-by-row layout with columnsCount labels across)
          <div>
            {rollRows.map((rowStickers, rIdx) => (
              <div
                key={rIdx}
                className="label-page-break flex flex-row items-center"
                style={{
                  width: `${totalRollWidthMm}mm`,
                  height: `${heightMm}mm`,
                  boxSizing: "border-box",
                  overflow: "hidden",
                  paddingLeft: `${marginLeft}mm`,
                }}
              >
                {Array.from({ length: cols }).map((_, cIdx) => {
                  const stk = rowStickers[cIdx];
                  return (
                    <div
                      key={cIdx}
                      style={{
                        width: `${widthMm}mm`,
                        height: `${heightMm}mm`,
                        marginRight: cIdx < cols - 1 ? `${gapX}mm` : 0,
                        boxSizing: "border-box",
                        overflow: "hidden",
                      }}
                      className="flex items-center justify-center"
                    >
                      {stk ? (
                        <div
                          style={{
                            width: `${widthMm}mm`,
                            height: `${heightMm}mm`,
                          }}
                        >
                          <StickerView
                            data={stk}
                            layout={layout}
                            companyName={companyName}
                            scale={1}
                            className="border-none shadow-none !p-0.5 w-full h-full"
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          // Multi-label Sheet Mode (A4 / Letter grid with multiple columns & rows)
          <div>
            {sheets.map((sheetItems, sIdx) => (
              <div
                key={sIdx}
                className="label-page-break"
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${columnsCount}, ${widthMm}mm)`,
                  columnGap: `${gapX}mm`,
                  rowGap: `${gapY}mm`,
                  boxSizing: "border-box",
                }}
              >
                {sheetItems.map((stk, iIdx) => (
                  <div
                    key={iIdx}
                    style={{
                      width: `${widthMm}mm`,
                      height: `${heightMm}mm`,
                      boxSizing: "border-box",
                      overflow: "hidden",
                    }}
                  >
                    <StickerView
                      data={stk}
                      layout={layout}
                      companyName={companyName}
                      scale={1}
                      className="border border-black/10 shadow-none !p-1 w-full h-full"
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

