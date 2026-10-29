"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOrganizationId, requireOwnedRecord, withOrganization } from "@/lib/tenant-db";
import { getPermissionContext } from "@/lib/rbac";
import { normalizeBarcode } from "@/lib/item-master";

export async function requireBarcodePrintingAccess() {
  const ctx = await getPermissionContext();
  if (!ctx.isAuthenticated || !ctx.userId) {
    throw new Error("Authentication required");
  }
  const hasAccess =
    ctx.isSuperadmin ||
    ctx.permissions.includes("settings.barcode.print") ||
    ctx.permissions.includes("settings.masters.manage") ||
    ctx.permissions.includes("inventory.access") ||
    ctx.permissions.includes("pos.access") ||
    ctx.permissions.includes("settings.data.access");

  if (!hasAccess) {
    throw new Error("You do not have permission to access Barcode & Sticker Printing.");
  }
  return ctx;
}

export interface PrintableUnit {
  unitName: string;
  isDefault: boolean;
  barcode: string;
  conversionFactor: number;
  sellingPrice: number;
  hasValidBarcode: boolean;
}

export interface PrintableItem {
  id: string;
  name: string;
  itemCode: string | null;
  defaultUnit: string;
  category: string | null;
  units: PrintableUnit[];
}

/**
 * Search items for sticker printing, returning item details along with
 * all available units (default + alternates) and their unit-specific barcodes & selling prices.
 */
export async function searchItemsForPrinting(params: {
  query?: string;
  categoryId?: string | null;
}): Promise<PrintableItem[]> {
  await requireBarcodePrintingAccess();
  const organizationId = await requireOrganizationId();

  let where: any = withOrganization(organizationId, {
    isActive: true,
    itemType: "INVENTORY",
  });

  if (params.categoryId && params.categoryId !== "all") {
    const cat = await prisma.itemCategory.findFirst({
      where: withOrganization(organizationId, { id: params.categoryId }),
      select: { name: true },
    });
    if (cat) {
      where.category = cat.name;
    }
  }

  if (params.query && params.query.trim()) {
    const q = params.query.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { itemCode: { contains: q, mode: "insensitive" } },
    ];
  }

  const items = await prisma.item.findMany({
    where,
    select: {
      id: true,
      name: true,
      itemCode: true,
      defaultUnit: true,
      category: true,
      unitConversions: {
        select: {
          id: true,
          unitName: true,
          conversionFactor: true,
          barcode: true,
        },
        orderBy: { unitName: "asc" },
      },
    },
    orderBy: { name: "asc" },
    take: 50,
  });

  if (items.length === 0) {
    return [];
  }

  const itemIds = items.map((i) => i.id);

  // Fetch the active Selling Price List
  const defaultSellingPl = await prisma.priceList.findFirst({
    where: withOrganization(organizationId, {
      type: "SELLING",
      isSystemDefault: true,
      isActive: true,
    }),
    select: { id: true },
  });

  // Index prices strictly by compound key `${itemId}:${normalizedUnitName}`
  const priceMap = new Map<string, number>();
  if (defaultSellingPl) {
    const priceItems = await prisma.priceListItem.findMany({
      where: withOrganization(organizationId, {
        priceListId: defaultSellingPl.id,
        itemId: { in: itemIds },
      }),
      select: { itemId: true, unitName: true, price: true },
    });
    for (const p of priceItems) {
      const u = String(p.unitName || "").trim().toLowerCase();
      priceMap.set(`${p.itemId}:${u}`, Number(p.price || 0));
    }
  }

  return items.map((item) => {
    const normDefUnit = String(item.defaultUnit || "").trim().toLowerCase();
    const defaultUnitPrice = priceMap.get(`${item.id}:${normDefUnit}`) ?? 0;
    const normItemCode = normalizeBarcode(item.itemCode);

    const defaultUnitEntry: PrintableUnit = {
      unitName: item.defaultUnit,
      isDefault: true,
      barcode: normItemCode,
      conversionFactor: 1,
      sellingPrice: defaultUnitPrice,
      hasValidBarcode: Boolean(normItemCode),
    };

    const alternateUnitEntries: PrintableUnit[] = item.unitConversions.map((conv) => {
      const normUnit = String(conv.unitName || "").trim().toLowerCase();
      const directPrice = priceMap.get(`${item.id}:${normUnit}`);
      const factor = Number(conv.conversionFactor) || 1;
      const calculatedPrice =
        directPrice !== undefined
          ? directPrice
          : Math.round((defaultUnitPrice * factor + Number.EPSILON) * 100) / 100;
      const normBarcode = normalizeBarcode(conv.barcode);

      return {
        unitName: conv.unitName,
        isDefault: false,
        barcode: normBarcode,
        conversionFactor: factor,
        sellingPrice: calculatedPrice,
        hasValidBarcode: Boolean(normBarcode),
      };
    });

    return {
      id: item.id,
      name: item.name,
      itemCode: item.itemCode,
      defaultUnit: item.defaultUnit,
      category: item.category,
      units: [defaultUnitEntry, ...alternateUnitEntries],
    };
  });
}

/**
 * Re-validates an individual sticker row's item, unit, barcode, and selling price.
 */
export async function resolveItemUnitPrintData(itemId: string, unitName: string) {
  await requireBarcodePrintingAccess();
  const organizationId = await requireOrganizationId();

  const item = await prisma.item.findFirst({
    where: withOrganization(organizationId, { id: itemId }),
    select: {
      id: true,
      name: true,
      itemCode: true,
      defaultUnit: true,
      category: true,
      unitConversions: {
        where: { unitName: { equals: unitName.trim(), mode: "insensitive" } },
        select: { unitName: true, conversionFactor: true, barcode: true },
      },
    },
  });

  if (!item) {
    return { ok: false, error: "Item not found in current organization." };
  }

  const isDefault = item.defaultUnit.trim().toLowerCase() === unitName.trim().toLowerCase();
  let barcode = "";
  let conversionFactor = 1;

  if (isDefault) {
    barcode = normalizeBarcode(item.itemCode);
    conversionFactor = 1;
  } else {
    const conv = item.unitConversions[0];
    if (!conv) {
      return { ok: false, error: `Unit "${unitName}" not found on item "${item.name}".` };
    }
    barcode = normalizeBarcode(conv.barcode);
    conversionFactor = Number(conv.conversionFactor) || 1;
  }

  const defaultSellingPl = await prisma.priceList.findFirst({
    where: withOrganization(organizationId, {
      type: "SELLING",
      isSystemDefault: true,
      isActive: true,
    }),
    select: { id: true },
  });

  let sellingPrice = 0;
  if (defaultSellingPl) {
    const exactPrice = await prisma.priceListItem.findFirst({
      where: withOrganization(organizationId, {
        priceListId: defaultSellingPl.id,
        itemId: item.id,
        unitName: { equals: unitName.trim(), mode: "insensitive" },
      }),
      select: { price: true },
    });

    if (exactPrice && Number(exactPrice.price) >= 0) {
      sellingPrice = Number(exactPrice.price);
    } else if (!isDefault) {
      const defaultPrice = await prisma.priceListItem.findFirst({
        where: withOrganization(organizationId, {
          priceListId: defaultSellingPl.id,
          itemId: item.id,
          unitName: { equals: item.defaultUnit.trim(), mode: "insensitive" },
        }),
        select: { price: true },
      });
      if (defaultPrice && Number(defaultPrice.price) >= 0) {
        sellingPrice =
          Math.round((Number(defaultPrice.price) * conversionFactor + Number.EPSILON) * 100) / 100;
      }
    }
  }

  return {
    ok: true,
    data: {
      itemId: item.id,
      itemName: item.name,
      unitName,
      isDefault,
      barcode,
      hasBarcode: Boolean(barcode),
      sellingPrice,
      category: item.category,
    },
  };
}

export interface BarcodeLayoutInput {
  id?: string;
  name: string;
  isDefault?: boolean;
  paperType: "ROLL" | "SHEET";
  widthMm: number;
  heightMm: number;
  columnsCount: number;
  rowsPerPage: number;
  gapX: number;
  gapY: number;
  marginTop: number;
  marginLeft: number;

  showCompanyName: boolean;
  companyTitle?: string | null;
  showItemName: boolean;
  showPrice: boolean;
  showUnit: boolean;
  showBarcodeText: boolean;
  showCategory: boolean;

  barcodeFormat: "CODE128" | "EAN13" | "QR";
  barcodeHeight: number;
  fontSize: number;
  textAlign: string;
  companyAlign?: "left" | "center" | "right";
  itemAlign?: "left" | "center" | "right";
  barcodeAlign?: "left" | "center" | "right";
  priceAlign?: "left" | "center" | "right";
  companySize?: "small" | "normal" | "large";
  itemSize?: "small" | "normal" | "large";
  priceSize?: "small" | "normal" | "large";
  currencySymbol: string;
  printerName?: string | null;
  density?: number;
  speed?: number;
  sensorType?: "GAP" | "BLACK_MARK" | "CONTINUOUS";
}

const DEFAULT_PRESETS: BarcodeLayoutInput[] = [
  {
    name: "Standard 3-Across Roll (32x18mm)",
    isDefault: true,
    paperType: "ROLL",
    widthMm: 32,
    heightMm: 18,
    columnsCount: 3,
    rowsPerPage: 1,
    gapX: 1.5,
    gapY: 3,
    marginTop: 2.5,
    marginLeft: 1.2,
    showCompanyName: true,
    showItemName: true,
    showPrice: true,
    showUnit: true,
    showBarcodeText: true,
    showCategory: false,
    barcodeFormat: "CODE128",
    barcodeHeight: 4.0,
    fontSize: 9,
    textAlign: "center",
    currencySymbol: "Rs.",
    printerName: "TSC TTP-244 Pro",
    density: 10,
    speed: 3,
    sensorType: "GAP",
  },
  {
    name: "Standard 50x25mm Thermal Roll (1-Across)",
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
    printerName: "TSC TTP-244 Pro",
  },
  {
    name: "Compact 40x30mm Thermal Roll",
    isDefault: false,
    paperType: "ROLL",
    widthMm: 40,
    heightMm: 30,
    columnsCount: 1,
    rowsPerPage: 1,
    gapX: 0,
    gapY: 2,
    marginTop: 1,
    marginLeft: 1,
    showCompanyName: true,
    showItemName: true,
    showPrice: true,
    showUnit: true,
    showBarcodeText: true,
    showCategory: false,
    barcodeFormat: "CODE128",
    barcodeHeight: 11,
    fontSize: 9,
    textAlign: "center",
    currencySymbol: "Rs.",
  },
  {
    name: "Jewelry / Small 38x25mm Roll",
    isDefault: false,
    paperType: "ROLL",
    widthMm: 38,
    heightMm: 25,
    columnsCount: 1,
    rowsPerPage: 1,
    gapX: 0,
    gapY: 2,
    marginTop: 1,
    marginLeft: 1,
    showCompanyName: false,
    showItemName: true,
    showPrice: true,
    showUnit: false,
    showBarcodeText: true,
    showCategory: false,
    barcodeFormat: "CODE128",
    barcodeHeight: 8,
    fontSize: 8,
    textAlign: "center",
    currencySymbol: "Rs.",
  },
  {
    name: "A4 Sticker Sheet (3x8 - 24 Labels)",
    isDefault: false,
    paperType: "SHEET",
    widthMm: 70,
    heightMm: 37,
    columnsCount: 3,
    rowsPerPage: 8,
    gapX: 2.5,
    gapY: 0,
    marginTop: 5,
    marginLeft: 5,
    showCompanyName: true,
    showItemName: true,
    showPrice: true,
    showUnit: true,
    showBarcodeText: true,
    showCategory: false,
    barcodeFormat: "CODE128",
    barcodeHeight: 12,
    fontSize: 10,
    textAlign: "center",
    currencySymbol: "Rs.",
  },
  {
    name: "Shipping / Large 100x50mm Roll",
    isDefault: false,
    paperType: "ROLL",
    widthMm: 100,
    heightMm: 50,
    columnsCount: 1,
    rowsPerPage: 1,
    gapX: 0,
    gapY: 3,
    marginTop: 2,
    marginLeft: 2,
    showCompanyName: true,
    showItemName: true,
    showPrice: true,
    showUnit: true,
    showBarcodeText: true,
    showCategory: true,
    barcodeFormat: "CODE128",
    barcodeHeight: 18,
    fontSize: 12,
    textAlign: "center",
    currencySymbol: "Rs.",
  },
];

/**
 * Fetch saved sticker layout presets, bootstrapping default presets if none exist.
 */
export async function getBarcodeLayouts() {
  await requireBarcodePrintingAccess();
  const organizationId = await requireOrganizationId();

  let layouts = await prisma.barcodeLayout.findMany({
    where: withOrganization(organizationId, {}),
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  if (layouts.length === 0) {
    // Seed default presets for this organization
    for (const preset of DEFAULT_PRESETS) {
      await prisma.barcodeLayout.create({
        data: {
          organizationId,
          ...preset,
        },
      });
    }
    layouts = await prisma.barcodeLayout.findMany({
      where: withOrganization(organizationId, {}),
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  } else {
    // Ensure 3-across roll preset exists and is the active default if not present
    const has3Up = layouts.some((l) => l.columnsCount === 3 && l.paperType === "ROLL");
    if (!has3Up) {
      await prisma.barcodeLayout.updateMany({
        where: withOrganization(organizationId, {}),
        data: { isDefault: false },
      });
      await prisma.barcodeLayout.create({
        data: {
          organizationId,
          ...DEFAULT_PRESETS[0],
        },
      });
      layouts = await prisma.barcodeLayout.findMany({
        where: withOrganization(organizationId, {}),
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      });
    }
  }

  return layouts;
}

/**
 * Save or update a sticker layout preset.
 */
export async function saveBarcodeLayout(input: BarcodeLayoutInput) {
  await requireBarcodePrintingAccess();
  const organizationId = await requireOrganizationId();

  const name = String(input.name || "").trim();
  if (!name) return { ok: false, error: "Layout name is required." };
  if (input.widthMm <= 0 || input.heightMm <= 0) {
    return { ok: false, error: "Width and height must be greater than 0 mm." };
  }
  if (input.columnsCount < 1) {
    return { ok: false, error: "Columns count must be at least 1." };
  }

  if (input.isDefault) {
    await prisma.barcodeLayout.updateMany({
      where: withOrganization(organizationId, {}),
      data: { isDefault: false },
    });
  }

  const data = {
    name,
    isDefault: Boolean(input.isDefault),
    paperType: input.paperType || "ROLL",
    widthMm: Number(input.widthMm),
    heightMm: Number(input.heightMm),
    columnsCount: Math.max(1, Number(input.columnsCount)),
    rowsPerPage: Math.max(1, Number(input.rowsPerPage || 1)),
    gapX: Number(input.gapX !== undefined ? input.gapX : 1.5),
    gapY: Number(input.gapY !== undefined ? input.gapY : 3.0),
    marginTop: Number(input.marginTop !== undefined ? input.marginTop : 2.5),
    marginLeft: Number(input.marginLeft !== undefined ? input.marginLeft : 1.2),

    showCompanyName: Boolean(input.showCompanyName),
    companyTitle: input.companyTitle ? String(input.companyTitle).trim() : null,
    showItemName: Boolean(input.showItemName),
    showPrice: Boolean(input.showPrice),
    showUnit: Boolean(input.showUnit),
    showBarcodeText: Boolean(input.showBarcodeText),
    showCategory: Boolean(input.showCategory),

    barcodeFormat: input.barcodeFormat || "CODE128",
    barcodeHeight: input.barcodeHeight !== undefined && !isNaN(Number(input.barcodeHeight)) ? Number(input.barcodeHeight) : 4.0,
    fontSize: Number(input.fontSize || 10),
    textAlign: input.textAlign ? String(input.textAlign).trim() : "center",
    currencySymbol: String(input.currencySymbol || "Rs."),
    printerName: input.printerName ? String(input.printerName).trim() : null,
    density: Math.min(15, Math.max(1, Number(input.density !== undefined ? input.density : 10))),
    speed: Math.min(6, Math.max(2, Number(input.speed !== undefined ? input.speed : 3))),
    sensorType: input.sensorType || "GAP",
  };

  let saved;
  if (input.id) {
    await requireOwnedRecord(prisma.barcodeLayout as any, input.id, organizationId);
    saved = await prisma.barcodeLayout.update({
      where: { id: input.id },
      data,
    });
  } else {
    saved = await prisma.barcodeLayout.create({
      data: {
        organizationId,
        ...data,
      },
    });
  }

  revalidatePath("/barcode-printing");
  return { ok: true, layout: saved };
}

/**
 * Delete a custom layout preset.
 */
export async function deleteBarcodeLayout(id: string) {
  await requireBarcodePrintingAccess();
  const organizationId = await requireOrganizationId();

  await requireOwnedRecord(prisma.barcodeLayout as any, id, organizationId);
  await prisma.barcodeLayout.delete({ where: { id } });

  revalidatePath("/barcode-printing");
  return { ok: true };
}

/**
 * Set a layout preset as the organization's default.
 */
export async function setDefaultBarcodeLayout(id: string) {
  await requireBarcodePrintingAccess();
  const organizationId = await requireOrganizationId();

  await requireOwnedRecord(prisma.barcodeLayout as any, id, organizationId);

  await prisma.barcodeLayout.updateMany({
    where: withOrganization(organizationId, {}),
    data: { isDefault: false },
  });

  const updated = await prisma.barcodeLayout.update({
    where: { id },
    data: { isDefault: true },
  });

  revalidatePath("/barcode-printing");
  return { ok: true, layout: updated };
}

/**
 * Retrieve categories for filtering items in the sticker printing module.
 */
export async function getCategoriesForPrinting() {
  await requireBarcodePrintingAccess();
  const organizationId = await requireOrganizationId();

  return await prisma.itemCategory.findMany({
    where: withOrganization(organizationId, {}),
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Get organization company name and settings for label headers.
 */
export async function getCompanyPrintInfo() {
  await requireBarcodePrintingAccess();
  const organizationId = await requireOrganizationId();

  const company = await prisma.companySettings.findUnique({
    where: { organizationId },
    select: { companyName: true, baseCurrency: true },
  });

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });

  return {
    companyName: company?.companyName || org?.name || "TradeFix",
    baseCurrency: company?.baseCurrency || "PKR",
  };
}

/**
 * Check connectivity of the local TradeFix Print Bridge for direct USB printing.
 */
export async function checkPrinterBridgeStatus() {
  await requireBarcodePrintingAccess();

  const endpoints = [
    "http://host.docker.internal:9190/status",
    "http://127.0.0.1:9190/status",
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        return { ok: true, ...data };
      }
    } catch {
      // try next
    }
  }

  return {
    ok: false,
    online: false,
    printerName: "TSC TTP-244 Pro",
    message: "Local print bridge not detected on port 9190",
  };
}

/**
 * Dispatch raw TSPL commands directly to the connected TSC TTP-244 Pro via the print bridge.
 */
export async function dispatchDirectPrintToBridge(tspl: string, printerName: string = "TSC TTP-244 Pro") {
  await requireBarcodePrintingAccess();

  if (!tspl || !tspl.trim()) {
    return { ok: false, error: "TSPL command stream is empty" };
  }

  const endpoints = [
    "http://host.docker.internal:9190/print",
    "http://127.0.0.1:9190/print",
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ printerName, tspl }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (res.ok && data.success) {
        return { ok: true, bytesWritten: data.bytesWritten, printer: data.printer };
      } else {
        return { ok: false, error: data.error || "Print bridge rejected job" };
      }
    } catch (err: any) {
      // try next
    }
  }

  return {
    ok: false,
    error: "Unable to reach TradeFix Print Bridge at host.docker.internal:9190 or 127.0.0.1:9190.",
  };
}

/**
 * Dispatch test sticker directly to the connected TSC TTP-244 Pro via the print bridge.
 */
export async function dispatchDirectTestPrintToBridge(printerName: string = "TSC TTP-244 Pro") {
  await requireBarcodePrintingAccess();

  const endpoints = [
    "http://host.docker.internal:9190/test",
    "http://127.0.0.1:9190/test",
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Length": "0" },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (res.ok && data.success) {
        return { ok: true, bytesWritten: data.bytesWritten, message: data.message };
      } else {
        return { ok: false, error: data.error || "Print bridge error on test print" };
      }
    } catch (err: any) {
      // try next
    }
  }

  return {
    ok: false,
    error: "Unable to reach TradeFix Print Bridge for test print.",
  };
}
