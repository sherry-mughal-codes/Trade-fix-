/**
 * Native TSPL (TSC Printer Language) Generator for Thermal Label Printers.
 * 
 * Supports multi-column rolls (e.g. 3-across / 3-UP 32x18mm, 32x25mm) and single rolls.
 * Resolution: 203 DPI (8 dots/mm).
 * - 1 mm = 8 dots
 * - 32 mm = 256 dots
 * - 18 mm = 144 dots
 * - 25 mm = 200 dots
 * - 104 mm total roll width = 832 dots
 */

export type TextAlignment = "left" | "center" | "right";
export type ElementTextSize = "small" | "normal" | "large";

export interface TSPLPrinterConfig {
  printerModel?: string; // e.g. "TSC TTP-244 Pro", "Thermal Label Printer", etc.
  density?: number; // Darkness: 1 to 15 (default: 10)
  speed?: number; // Speed in inches/sec: 2 to 4 ips (default: 3)
  sensorType?: "GAP" | "BLACK_MARK" | "CONTINUOUS";
  gapLengthMm?: number; // Default 3mm
  gapOffsetMm?: number; // Default 0mm
}

export interface TSPLStickerItem {
  itemName: string;
  unitName: string;
  sellingPrice: number;
  barcode: string;
  quantity: number;
  category?: string | null;
  companyTitle?: string | null;
}

export interface TSPLLayoutConfig {
  widthMm?: number; // Width of single label (default 32mm)
  heightMm?: number; // Height of single label (default 18mm)
  columnsCount?: number; // default 3 for 3-UP roll
  rowsPerPage?: number;
  gapX?: number; // Horizontal gap between adjacent labels in mm (default 1.5mm)
  gapY?: number; // Vertical gap between rows in mm (default 3.0mm)
  marginTop?: number; // Top margin in mm (default 2.5mm for clean cut clearance)
  marginLeft?: number; // Left margin in mm (default 1.2mm)
  showCompanyName?: boolean;
  companyTitle?: string | null;
  showItemName?: boolean;
  showPrice?: boolean;
  showUnit?: boolean;
  showBarcodeText?: boolean;
  barcodeHeight?: number; // Barcode height in mm (from user settings)
  barcodeHeightMm?: number; // Barcode height in mm
  density?: number; // Darkness: 1 to 15 (from user settings)
  speed?: number; // Speed in ips: 2 to 4 (from user settings)
  sensorType?: "GAP" | "BLACK_MARK" | "CONTINUOUS"; // from user settings
  currencySymbol?: string;
  textAlign?: string; // "center" | "left" | "right" or JSON string
  companyAlign?: TextAlignment;
  itemAlign?: TextAlignment;
  barcodeAlign?: TextAlignment;
  priceAlign?: TextAlignment;
  companySize?: ElementTextSize;
  itemSize?: ElementTextSize;
  priceSize?: ElementTextSize;
  printerName?: string | null;
}

export interface CalculatedElement {
  type: "text" | "barcode";
  text?: string;
  font?: "1" | "2" | "3"; // TSPL fonts: "1" (8x12), "2" (12x20), "3" (16x24)
  charWidthDots?: number;
  charHeightDots?: number;
  code?: string;
  x: number; // dot coordinate relative to column
  y: number; // dot coordinate relative to label top
  widthDots: number;
  heightDots: number;
  narrow?: number;
  align?: TextAlignment;
  size?: ElementTextSize;
}

export interface StickerLayoutCalculation {
  widthDots: number;
  heightDots: number;
  density: number;
  elements: CalculatedElement[];
  company?: CalculatedElement;
  item?: CalculatedElement;
  barcode: CalculatedElement;
  barcodeText?: CalculatedElement;
  price?: CalculatedElement;
}

export interface ElementPreferences {
  companyAlign: TextAlignment;
  itemAlign: TextAlignment;
  barcodeAlign: TextAlignment;
  priceAlign: TextAlignment;
  companySize: ElementTextSize;
  itemSize: ElementTextSize;
  priceSize: ElementTextSize;
}

/**
 * Parse text alignments and text sizes for individual sticker elements from the layout.
 */
export function parseAlignments(textAlign?: string): ElementPreferences {
  const def: ElementPreferences = {
    companyAlign: "center",
    itemAlign: "center",
    barcodeAlign: "center",
    priceAlign: "center",
    companySize: "normal",
    itemSize: "normal",
    priceSize: "normal",
  };
  if (!textAlign) return def;

  const trimmed = textAlign.trim();
  if (trimmed.startsWith("{")) {
    try {
      const p = JSON.parse(trimmed);
      return {
        companyAlign: p.company || p.companyAlign || "center",
        itemAlign: p.item || p.itemAlign || "center",
        barcodeAlign: p.barcode || p.barcodeAlign || "center",
        priceAlign: p.price || p.priceAlign || "center",
        companySize: p.companySize || "normal",
        itemSize: p.itemSize || "normal",
        priceSize: p.priceSize || "normal",
      };
    } catch {
      return def;
    }
  }

  if (trimmed === "left" || trimmed === "right" || trimmed === "center") {
    return {
      ...def,
      companyAlign: trimmed,
      itemAlign: trimmed,
      barcodeAlign: trimmed,
      priceAlign: trimmed,
    };
  }

  return def;
}

/**
 * Serialize individual element alignments and sizes into a compact JSON string.
 */
export function serializeAlignments(prefs: {
  companyAlign?: TextAlignment;
  itemAlign?: TextAlignment;
  barcodeAlign?: TextAlignment;
  priceAlign?: TextAlignment;
  companySize?: ElementTextSize;
  itemSize?: ElementTextSize;
  priceSize?: ElementTextSize;
}): string {
  return JSON.stringify({
    company: prefs.companyAlign || "center",
    item: prefs.itemAlign || "center",
    barcode: prefs.barcodeAlign || "center",
    price: prefs.priceAlign || "center",
    companySize: prefs.companySize || "normal",
    itemSize: prefs.itemSize || "normal",
    priceSize: prefs.priceSize || "normal",
  });
}

/**
 * Calculate horizontal X position for an element based on alignment.
 */
export function computeAlignedX(
  colX: number,
  labelWidthDots: number,
  elementWidthDots: number,
  align: TextAlignment = "center",
  sidePadDots: number = 10
): number {
  if (align === "left") {
    return colX + sidePadDots;
  }
  if (align === "right") {
    return colX + Math.max(sidePadDots, labelWidthDots - elementWidthDots - sidePadDots);
  }
  // center
  return colX + Math.max(sidePadDots, Math.round((labelWidthDots - elementWidthDots) / 2));
}

/**
 * Authoritative single source of truth for sticker layout geometry.
 * Used identically by TSPL command generation and Web UI Sticker Preview.
 */
export function calculateStickerLayout(
  item: {
    itemName: string;
    unitName?: string;
    sellingPrice?: number;
    barcode: string;
    companyTitle?: string | null;
  },
  layout: TSPLLayoutConfig = {},
  colXOffset: number = 0
): StickerLayoutCalculation {
  const widthMm = layout.widthMm !== undefined ? layout.widthMm : 32;
  const heightMm = layout.heightMm !== undefined ? layout.heightMm : 18;
  const widthDots = Math.round(widthMm * 8); // e.g. 256 dots for 32mm
  const heightDots = Math.round(heightMm * 8); // e.g. 144 dots for 18mm
  const currency = layout.currencySymbol || "Rs.";
  const density = layout.density !== undefined ? layout.density : 10;

  // Parse element-level alignments & sizes
  const parsedPrefs = parseAlignments(layout.textAlign);
  const companyAlign = layout.companyAlign || parsedPrefs.companyAlign || "center";
  const itemAlign = layout.itemAlign || parsedPrefs.itemAlign || "center";
  const barcodeAlign = layout.barcodeAlign || parsedPrefs.barcodeAlign || "center";
  const priceAlign = layout.priceAlign || parsedPrefs.priceAlign || "center";

  const companySize = layout.companySize || parsedPrefs.companySize || "normal";
  const itemSize = layout.itemSize || parsedPrefs.itemSize || "normal";
  const priceSize = layout.priceSize || parsedPrefs.priceSize || "normal";

  // Margin top in dots: default 2.5mm (20 dots) ensures company name is never cut off by top die-cut!
  const topMDots = Math.round(Math.max(1.0, layout.marginTop !== undefined ? layout.marginTop : 2.5) * 8);
  const botMDots = Math.round(Math.max(0.5, (layout.marginTop !== undefined ? layout.marginTop : 2.5) * 0.5) * 8);
  const usableH = Math.max(40, heightDots - topMDots - botMDots);

  // 1. Prepare Text Elements & Measure Fixed Heights
  let compElem: CalculatedElement | undefined;
  if (layout.showCompanyName !== false) {
    let compText = (item.companyTitle || layout.companyTitle || "Store")
      .replace(/["\\]/g, "")
      .trim();
    // User requirement 1: Increase character threshold from 16 to 18 before "..." appears
    if (compText.length > 18) {
      compText = compText.slice(0, 18).trim() + "...";
    }

    if (compText) {
      let font: "1" | "2" | "3" = "2";
      let charW = 12;
      let charH = 20;

      if (companySize === "small") {
        font = "1";
        charW = 8;
        charH = 12;
      } else if (companySize === "large") {
        if (compText.length <= 12) {
          font = "3";
          charW = 16;
          charH = 24;
        } else {
          font = "2";
          charW = 12;
          charH = 20;
        }
      } else {
        // normal
        if (compText.length > 17) {
          font = "1";
          charW = 8;
          charH = 12;
        }
      }

      const textW = compText.length * charW;
      const x = computeAlignedX(colXOffset, widthDots, textW, companyAlign);
      compElem = {
        type: "text",
        text: compText,
        font,
        charWidthDots: charW,
        charHeightDots: charH,
        x,
        y: 0,
        widthDots: textW,
        heightDots: charH,
        align: companyAlign,
        size: companySize,
      };
    }
  }

  let itemElem: CalculatedElement | undefined;
  if (layout.showItemName !== false) {
    let itemText = (item.itemName || "").replace(/["\\]/g, "").trim();
    if (layout.showUnit !== false && item.unitName && !itemText.toLowerCase().includes(item.unitName.toLowerCase())) {
      itemText = `${itemText} ${item.unitName}`;
    }

    // User requirement 1: Increase character threshold from 16 to 18 before "..." appears
    if (itemText.length > 18) {
      itemText = itemText.slice(0, 18).trim() + "...";
    }

    if (itemText) {
      let font: "1" | "2" | "3" = "2";
      let charW = 12;
      let charH = 20;

      if (itemSize === "small") {
        font = "1";
        charW = 8;
        charH = 12;
      } else if (itemSize === "large") {
        if (itemText.length <= 12) {
          font = "3";
          charW = 16;
          charH = 24;
        } else {
          font = "2";
          charW = 12;
          charH = 20;
        }
      } else {
        // normal
        if (itemText.length > 17) {
          font = "1";
          charW = 8;
          charH = 12;
        }
      }

      const textW = itemText.length * charW;
      const x = computeAlignedX(colXOffset, widthDots, textW, itemAlign);
      itemElem = {
        type: "text",
        text: itemText,
        font,
        charWidthDots: charW,
        charHeightDots: charH,
        x,
        y: 0,
        widthDots: textW,
        heightDots: charH,
        align: itemAlign,
        size: itemSize,
      };
    }
  }

  const barcodeStr = String(item.barcode || "").trim();
  const isNumeric = /^\d+$/.test(barcodeStr);
  const modules = 11 + (isNumeric ? Math.ceil(barcodeStr.length / 2) : barcodeStr.length) * 11 + 24;
  const narrow = (modules * 2 > widthDots - 20 || barcodeStr.length > 9) ? 1 : 2;
  const barWDots = modules * narrow;
  const barX = computeAlignedX(colXOffset, widthDots, barWDots, barcodeAlign);

  let codeTextElem: CalculatedElement | undefined;
  if (layout.showBarcodeText !== false && barcodeStr) {
    const charW = 8;
    const charH = 12;
    const textW = barcodeStr.length * charW;
    const x = computeAlignedX(colXOffset, widthDots, textW, barcodeAlign);
    codeTextElem = {
      type: "text",
      text: barcodeStr,
      font: "1",
      charWidthDots: charW,
      charHeightDots: charH,
      x,
      y: 0,
      widthDots: textW,
      heightDots: charH,
      align: barcodeAlign,
      size: "normal",
    };
  }

  let priceElem: CalculatedElement | undefined;
  if (layout.showPrice !== false) {
    const priceText = `${currency} ${Number(item.sellingPrice || 0).toFixed(2)}`;
    let font: "1" | "2" | "3" = "2";
    let charW = 12;
    let charH = 20;

    if (priceSize === "small") {
      font = "1";
      charW = 8;
      charH = 12;
    } else if (priceSize === "large") {
      font = "3";
      charW = 16;
      charH = 24;
    }

    const textW = priceText.length * charW;
    const x = computeAlignedX(colXOffset, widthDots, textW, priceAlign);
    priceElem = {
      type: "text",
      text: priceText,
      font,
      charWidthDots: charW,
      charHeightDots: charH,
      x,
      y: 0,
      widthDots: textW,
      heightDots: charH,
      align: priceAlign,
      size: priceSize,
    };
  }

  // 2. Intelligent Vertical Budgeting
  const activeList: { key: string; elem: CalculatedElement }[] = [];
  if (compElem) activeList.push({ key: "comp", elem: compElem });
  if (itemElem) activeList.push({ key: "item", elem: itemElem });

  // Placeholder for barcode
  const barcodeElem: CalculatedElement = {
    type: "barcode",
    code: barcodeStr,
    x: barX,
    y: 0,
    widthDots: barWDots,
    heightDots: 28,
    narrow,
    align: barcodeAlign,
  };
  activeList.push({ key: "barcode", elem: barcodeElem });

  if (codeTextElem) activeList.push({ key: "codeText", elem: codeTextElem });
  if (priceElem) activeList.push({ key: "price", elem: priceElem });

  const numGaps = Math.max(1, activeList.length - 1);
  const fixedTextH = (compElem?.heightDots || 0) +
                     (itemElem?.heightDots || 0) +
                     (codeTextElem?.heightDots || 0) +
                     (priceElem?.heightDots || 0);

  // Requested barcode height in dots
  const userBarMm = Number(layout.barcodeHeight || layout.barcodeHeightMm || 4.0);
  const reqBarHDots = Math.round(Math.max(2.0, userBarMm) * 8);

  // Maximum barcode height that physically fits with 3-dot gaps
  const maxSafeBarH = Math.max(16, usableH - fixedTextH - numGaps * 3);
  const actualBarH = Math.min(reqBarHDots, maxSafeBarH);
  barcodeElem.heightDots = actualBarH;

  // Calculate balanced symmetrical gaps
  const totalContentH = fixedTextH + actualBarH;
  const slack = Math.max(0, usableH - totalContentH);
  const gapSize = Math.max(2, Math.floor(slack / numGaps));
  const extraTopPadding = Math.floor((slack - gapSize * numGaps) / 2);

  // Position elements vertically with exact spacing
  let curY = topMDots + extraTopPadding;
  for (let i = 0; i < activeList.length; i++) {
    const itemEntry = activeList[i];
    itemEntry.elem.y = curY;
    curY += itemEntry.elem.heightDots + gapSize;
  }

  return {
    widthDots,
    heightDots,
    density,
    elements: activeList.map((a) => a.elem),
    company: compElem,
    item: itemElem,
    barcode: barcodeElem,
    barcodeText: codeTextElem,
    price: priceElem,
  };
}

/**
 * Generate native TSPL command string for the given batch of stickers.
 */
export function generateTSPLJob(
  items: TSPLStickerItem[],
  layout: TSPLLayoutConfig = {},
  config: TSPLPrinterConfig = {}
): string {
  const speed = layout.speed !== undefined ? layout.speed : (config.speed || 3);
  const density = layout.density !== undefined ? layout.density : (config.density || 10);
  const sensor = layout.sensorType || config.sensorType || "GAP";

  // Flatten items by quantity into individual labels
  const labels: {
    itemName: string;
    unitName: string;
    sellingPrice: number;
    barcode: string;
    companyTitle?: string | null;
  }[] = [];

  for (const it of items) {
    if (!it.barcode) continue;
    const qty = Math.max(1, it.quantity || 1);
    for (let q = 0; q < qty; q++) {
      labels.push({
        itemName: it.itemName,
        unitName: it.unitName,
        sellingPrice: it.sellingPrice,
        barcode: it.barcode,
        companyTitle: it.companyTitle,
      });
    }
  }

  if (labels.length === 0) return "";

  const cols = layout.columnsCount !== undefined ? Math.max(1, layout.columnsCount) : 3;
  const widthMm = layout.widthMm !== undefined ? layout.widthMm : 32;
  const heightMm = layout.heightMm !== undefined ? layout.heightMm : 18;
  const gapX = layout.gapX !== undefined ? layout.gapX : 1.5;
  const gapY = layout.gapY !== undefined ? layout.gapY : (config.gapLengthMm || 3.0);
  const marginLeft = layout.marginLeft !== undefined ? layout.marginLeft : 1.2;

  // Total roll width: 104mm for standard 3-across
  const totalRollWidthMm =
    cols > 1
      ? Math.round((marginLeft * 2) + (widthMm * cols) + (gapX * (cols - 1)))
      : widthMm;

  const commands: string[] = [];

  // 1. Initial Printer Setup Commands
  commands.push(`SIZE ${totalRollWidthMm} mm, ${heightMm} mm`);
  if (sensor === "GAP") {
    commands.push(`GAP ${gapY} mm, 0 mm`);
  } else if (sensor === "BLACK_MARK") {
    commands.push(`BLINE 2 mm, 0 mm`);
  }
  commands.push(`SPEED ${speed}`);
  commands.push(`DENSITY ${density}`);
  commands.push(`DIRECTION 1`);
  commands.push(`REFERENCE 0, 0`);

  const totalRows = Math.ceil(labels.length / cols);

  // 2. Iterate row by row (each row holds up to `cols` labels)
  for (let r = 0; r < totalRows; r++) {
    commands.push(``);
    commands.push(`; --- ROW ${r + 1} OF ${totalRows} ---`);
    commands.push(`CLS`);

    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx >= labels.length) break;
      const label = labels[idx];

      // Physical coordinate calculation for Column `c`
      const colLeftMm = cols > 1 ? marginLeft + c * (widthMm + gapX) : marginLeft;
      const colX = Math.round(colLeftMm * 8);

      // Use authoritative mathematical layout calculation
      const stickerLayout = calculateStickerLayout(label, layout, colX);

      // Element 1: Store Name
      if (stickerLayout.company) {
        commands.push(
          `TEXT ${stickerLayout.company.x},${stickerLayout.company.y},"${stickerLayout.company.font}",0,1,1,"${stickerLayout.company.text}"`
        );
      }

      // Element 2: Item Name
      if (stickerLayout.item) {
        commands.push(
          `TEXT ${stickerLayout.item.x},${stickerLayout.item.y},"${stickerLayout.item.font}",0,1,1,"${stickerLayout.item.text}"`
        );
      }

      // Element 3: Code 128 Barcode
      const bar = stickerLayout.barcode;
      commands.push(
        `BARCODE ${bar.x},${bar.y},"128",${bar.heightDots},0,0,${bar.narrow},${bar.narrow},"${bar.code}"`
      );

      // Element 4: Human-Readable Barcode Text
      if (stickerLayout.barcodeText) {
        commands.push(
          `TEXT ${stickerLayout.barcodeText.x},${stickerLayout.barcodeText.y},"1",0,1,1,"${stickerLayout.barcodeText.text}"`
        );
      }

      // Element 5: Selling Price
      if (stickerLayout.price) {
        commands.push(
          `TEXT ${stickerLayout.price.x},${stickerLayout.price.y},"${stickerLayout.price.font}",0,1,1,"${stickerLayout.price.text}"`
        );
      }
    }

    commands.push(`PRINT 1, 1`);
  }

  return commands.join("\r\n") + "\r\n";
}
