import { Metadata } from "next";
import {
  requireBarcodePrintingAccess,
  getBarcodeLayouts,
  getCategoriesForPrinting,
  getCompanyPrintInfo,
  type BarcodeLayoutInput,
} from "./actions";
import BarcodePrintingClient from "./barcode-printing-client";

export const metadata: Metadata = {
  title: "Barcode & Sticker Printing | TradeFix",
  description: "Thermal barcode label printing, sticker layout presets, and test printing.",
};

export const dynamic = "force-dynamic";

export default async function BarcodePrintingPage() {
  await requireBarcodePrintingAccess();

  const [layouts, categories, companyInfo] = await Promise.all([
    getBarcodeLayouts(),
    getCategoriesForPrinting(),
    getCompanyPrintInfo(),
  ]);

  const sanitizedLayouts: BarcodeLayoutInput[] = layouts.map((l) => ({
    id: l.id,
    name: l.name,
    isDefault: l.isDefault,
    paperType: l.paperType as "ROLL" | "SHEET",
    widthMm: l.widthMm,
    heightMm: l.heightMm,
    columnsCount: l.columnsCount,
    rowsPerPage: l.rowsPerPage,
    gapX: l.gapX,
    gapY: l.gapY,
    marginTop: l.marginTop,
    marginLeft: l.marginLeft,
    showCompanyName: l.showCompanyName,
    companyTitle: l.companyTitle,
    showItemName: l.showItemName,
    showPrice: l.showPrice,
    showUnit: l.showUnit,
    showBarcodeText: l.showBarcodeText,
    showCategory: l.showCategory,
    barcodeFormat: l.barcodeFormat as "CODE128" | "EAN13" | "QR",
    barcodeHeight: l.barcodeHeight,
    fontSize: l.fontSize,
    textAlign: l.textAlign as "left" | "center" | "right",
    currencySymbol: l.currencySymbol,
    printerName: l.printerName,
  }));

  return (
    <BarcodePrintingClient
      initialLayouts={sanitizedLayouts}
      categories={categories}
      companyName={companyInfo.companyName}
      baseCurrency={companyInfo.baseCurrency}
    />
  );
}

