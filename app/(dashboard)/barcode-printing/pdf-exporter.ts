import jsPDF from "jspdf";
import { type StickerData } from "./sticker-view";
import { type BarcodeLayoutInput } from "./actions";
import { encodeCode128B } from "@/lib/barcode-svg";

// Code 128 pattern widths for PDF vector rects
const PATTERNS: number[][] = [
  [2, 1, 2, 2, 2, 2], [2, 2, 2, 1, 2, 2], [2, 2, 2, 2, 2, 1], [1, 2, 1, 2, 2, 3],
  [1, 2, 1, 3, 2, 2], [1, 3, 1, 2, 2, 2], [1, 2, 2, 2, 1, 3], [1, 2, 2, 3, 1, 2],
  [1, 3, 2, 2, 1, 2], [2, 2, 1, 2, 1, 3], [2, 2, 1, 3, 1, 2], [2, 3, 1, 2, 1, 2],
  [1, 1, 2, 2, 3, 2], [1, 2, 2, 1, 3, 2], [1, 2, 2, 2, 3, 1], [1, 1, 3, 2, 2, 2],
  [1, 2, 3, 1, 2, 2], [1, 2, 3, 2, 2, 1], [2, 2, 3, 2, 1, 1], [2, 2, 1, 1, 3, 2],
  [2, 2, 1, 2, 3, 1], [2, 1, 3, 2, 1, 2], [2, 2, 3, 1, 1, 2], [3, 1, 2, 1, 3, 1],
  [3, 1, 1, 2, 2, 2], [3, 2, 1, 1, 2, 2], [3, 2, 1, 2, 2, 1], [3, 1, 2, 2, 1, 2],
  [3, 2, 2, 1, 1, 2], [3, 2, 2, 2, 1, 1], [2, 1, 2, 1, 2, 3], [2, 1, 2, 3, 2, 1],
  [2, 3, 2, 1, 2, 1], [1, 1, 1, 3, 2, 3], [1, 3, 1, 1, 2, 3], [1, 3, 1, 3, 2, 1],
  [1, 1, 2, 3, 1, 3], [1, 3, 2, 1, 1, 3], [1, 3, 2, 3, 1, 1], [2, 1, 1, 3, 1, 3],
  [2, 3, 1, 1, 1, 3], [2, 3, 1, 3, 1, 1], [1, 1, 2, 1, 3, 3], [1, 1, 2, 3, 3, 1],
  [1, 3, 2, 1, 3, 1], [1, 1, 3, 1, 2, 3], [1, 1, 3, 3, 2, 1], [1, 3, 3, 1, 2, 1],
  [3, 1, 3, 1, 2, 1], [2, 1, 1, 3, 3, 1], [2, 3, 1, 1, 3, 1], [2, 1, 3, 1, 1, 3],
  [2, 1, 3, 3, 1, 1], [2, 1, 3, 1, 3, 1], [3, 1, 1, 1, 2, 3], [3, 1, 1, 3, 2, 1],
  [3, 3, 1, 1, 2, 1], [3, 1, 2, 1, 1, 3], [3, 1, 2, 3, 1, 1], [3, 3, 2, 1, 1, 1],
  [3, 1, 4, 1, 1, 1], [2, 2, 1, 4, 1, 1], [4, 3, 1, 1, 1, 1], [1, 1, 1, 2, 2, 4],
  [1, 1, 1, 4, 2, 2], [1, 2, 1, 1, 2, 4], [1, 2, 1, 4, 2, 1], [1, 4, 1, 1, 2, 2],
  [1, 4, 1, 2, 2, 1], [1, 1, 2, 2, 1, 4], [1, 1, 2, 4, 1, 2], [1, 2, 2, 1, 1, 4],
  [1, 2, 2, 4, 1, 1], [1, 4, 2, 1, 1, 2], [1, 4, 2, 2, 1, 1], [2, 4, 1, 2, 1, 1],
  [2, 2, 1, 1, 1, 4], [4, 1, 3, 1, 1, 1], [2, 4, 1, 1, 1, 2], [1, 3, 4, 1, 1, 1],
  [1, 1, 1, 2, 4, 2], [1, 2, 1, 1, 4, 2], [1, 2, 1, 2, 4, 1], [1, 1, 4, 2, 1, 2],
  [1, 2, 4, 1, 1, 2], [1, 2, 4, 2, 1, 1], [4, 1, 1, 2, 1, 2], [4, 2, 1, 1, 1, 2],
  [4, 2, 1, 2, 1, 1], [2, 1, 2, 1, 4, 1], [2, 1, 4, 1, 2, 1], [4, 1, 2, 1, 2, 1],
  [1, 1, 1, 1, 4, 3], [1, 1, 1, 3, 4, 1], [1, 3, 1, 1, 4, 1], [1, 1, 4, 1, 1, 3],
  [1, 1, 4, 3, 1, 1], [4, 1, 1, 1, 1, 3], [4, 1, 1, 3, 1, 1], [1, 1, 3, 1, 4, 1],
  [1, 1, 4, 1, 3, 1], [3, 1, 1, 1, 4, 1], [4, 1, 1, 1, 3, 1], [2, 1, 1, 4, 1, 2],
  [2, 1, 1, 2, 1, 4], [2, 1, 1, 2, 3, 2], [2, 3, 3, 1, 1, 1, 2],
];

/**
 * Render vector barcode lines into jsPDF document.
 */
function drawVectorBarcode(
  doc: jsPDF,
  barcode: string,
  startX: number,
  startY: number,
  maxAvailableWidth: number,
  barHeight: number
) {
  const clean = String(barcode || "").trim();
  if (!clean) return;

  const codes = encodeCode128B(clean);

  // Calculate total modules
  let totalModules = 0;
  for (const c of codes) {
    const pat = PATTERNS[c];
    if (pat) {
      for (const w of pat) totalModules += w;
    }
  }

  // Calculate module width in mm to fit nicely
  const moduleWidth = Math.min(0.35, maxAvailableWidth / (totalModules + 4));
  const renderedWidth = totalModules * moduleWidth;
  let currentX = startX + (maxAvailableWidth - renderedWidth) / 2;

  doc.setFillColor(0, 0, 0);

  for (const c of codes) {
    const pat = PATTERNS[c];
    if (!pat) continue;
    for (let p = 0; p < pat.length; p++) {
      const width = pat[p] * moduleWidth;
      const isBar = p % 2 === 0;
      if (isBar) {
        doc.rect(currentX, startY, width, barHeight, "F");
      }
      currentX += width;
    }
  }
}

/**
 * Generate and download a PDF containing all stickers in the batch.
 */
export async function exportStickersToPDF(
  stickers: StickerData[],
  layout: BarcodeLayoutInput,
  companyName: string
) {
  if (stickers.length === 0) return;

  const isRoll = layout.paperType === "ROLL";
  const { widthMm, heightMm, columnsCount = 1, rowsPerPage = 1, gapX = 2, gapY = 2, marginTop = 1, marginLeft = 2 } = layout;

  const cols = Math.max(1, columnsCount);
  const totalRollWidthMm = cols > 1
    ? Math.round((marginLeft * 2) + (widthMm * cols) + (gapX * (cols - 1)))
    : widthMm;

  const doc = new jsPDF({
    orientation: totalRollWidthMm > heightMm ? "landscape" : "portrait",
    unit: "mm",
    format: isRoll ? [totalRollWidthMm, heightMm] : "a4",
  });

  const companyTitle = layout.companyTitle?.trim() || companyName;

  const drawSticker = (stk: StickerData, x: number, y: number, w: number, h: number) => {
    let curY = y + 2.5;

    // Header: Company Name (centered)
    if (layout.showCompanyName) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text(companyTitle.slice(0, 24), x + w / 2, curY, { align: "center" });
      curY += 3;
    }

    // Item Name & Unit (centered)
    if (layout.showItemName) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      let name = stk.itemName;
      if (layout.showUnit && stk.unitName && !name.toLowerCase().includes(stk.unitName.toLowerCase())) {
        name = `${name} ${stk.unitName}`;
      }
      doc.text(name.slice(0, 20), x + w / 2, curY, { align: "center" });
      curY += 3.2;
    }

    // Vector Barcode (centered)
    const bHeight = Math.min(layout.barcodeHeight || 5.5, Math.max(4, h - curY - 7));
    if (stk.barcode) {
      drawVectorBarcode(doc, stk.barcode, x + 2, curY, w - 4, bHeight);
      curY += bHeight + 1.8;

      if (layout.showBarcodeText) {
        doc.setFont("courier", "normal");
        doc.setFontSize(6.5);
        doc.text(stk.barcode, x + w / 2, curY, { align: "center" });
        curY += 2.2;
      }
    }

    // Bottom Footer: Price (centered)
    if (layout.showPrice) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      const priceStr = `${layout.currencySymbol || "Rs."} ${Number(stk.sellingPrice || 0).toFixed(2)}`;
      doc.text(priceStr, x + w / 2, y + h - 1.5, { align: "center" });
    }
  };

  if (isRoll) {
    // Row by row on thermal roll
    const totalRows = Math.ceil(stickers.length / cols);
    for (let r = 0; r < totalRows; r++) {
      if (r > 0) doc.addPage([totalRollWidthMm, heightMm]);
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (idx >= stickers.length) break;
        const colX = cols > 1 ? marginLeft + c * (widthMm + gapX) : marginLeft;
        drawSticker(stickers[idx], colX, marginTop, widthMm, heightMm);
      }
    }
  } else {
    // Multi-label sheet
    const perSheet = Math.max(1, cols * rowsPerPage);
    for (let i = 0; i < stickers.length; i++) {
      const sheetIndex = i % perSheet;
      if (i > 0 && sheetIndex === 0) {
        doc.addPage("a4", "portrait");
      }
      const col = sheetIndex % cols;
      const row = Math.floor(sheetIndex / cols);
      const x = marginLeft + col * (widthMm + gapX);
      const y = marginTop + row * (heightMm + gapY);

      doc.setDrawColor(220, 220, 220);
      doc.rect(x, y, widthMm, heightMm);
      drawSticker(stickers[i], x, y, widthMm, heightMm);
    }
  }

  const filename = `tradefix-stickers-${Date.now()}.pdf`;
  doc.save(filename);
}

