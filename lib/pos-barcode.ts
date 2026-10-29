import { prisma as defaultPrisma } from "./prisma";
import { normalizeBarcode } from "./item-master";

function withOrg<T extends Record<string, any> | undefined>(
  organizationId: string,
  where?: T,
) {
  return {
    ...(where || {}),
    organizationId,
  };
}

export async function resolveBarcodeForPOS(
  organizationId: string,
  rawBarcode: string,
  posProfileId: string,
  customerId?: string,
  db: any = defaultPrisma
) {
  const normalized = normalizeBarcode(rawBarcode);
  if (!normalized) {
    return { ok: false, error: "Please enter or scan a barcode." };
  }

  const profile = await db.pOSProfile.findFirst({
    where: withOrg(organizationId, {
      id: posProfileId,
      isActive: true,
    }),
    include: {
      posCounter: true,
    },
  });
  if (!profile) {
    return { ok: false, error: "POS profile not found." };
  }

  const linkedWarehouseName = profile.posCounter?.linkedWarehouseName || null;
  let priceListId = profile.defaultPriceListId;

  if (customerId && customerId !== profile.walkinCustomerId) {
    const customer = await db.party.findFirst({
      where: withOrg(organizationId, { id: customerId }),
      select: { sellingPriceListId: true },
    });
    if (customer?.sellingPriceListId) {
      priceListId = customer.sellingPriceListId;
    }
  }

  if (!priceListId) {
    const fallbackPL = await db.priceList.findFirst({
      where: withOrg(organizationId, {
        isActive: true,
        type: "SELLING",
      }),
      orderBy: [
        { isSystemDefault: "desc" },
        { createdAt: "asc" },
      ],
      select: { id: true },
    });
    if (fallbackPL) priceListId = fallbackPL.id;
  }

  // Step A: Check alternate units (ItemUnitConversion)
  const alternateMatches = await db.itemUnitConversion.findMany({
    where: withOrg(organizationId, {
      barcode: normalized,
    }),
    include: {
      item: true,
    },
  });

  let resolvedItem: any = null;
  let resolvedUnitName = "";
  let conversionFactor = 1;
  let isAlternateUnit = false;

  if (alternateMatches.length > 1) {
    return {
      ok: false,
      error: `Duplicate barcode detected: multiple alternate units match "${normalized}".`,
    };
  }

  if (alternateMatches.length === 1) {
    const match = alternateMatches[0];
    if (!match.item || !match.item.isActive) {
      return { ok: false, error: `Item for barcode "${normalized}" is inactive.` };
    }
    resolvedItem = match.item;
    resolvedUnitName = match.unitName;
    conversionFactor = Number(match.conversionFactor || 1);
    isAlternateUnit = true;
  } else {
    // Step B: Check default unit by Item Code (Item.itemCode)
    const itemMatches = await db.item.findMany({
      where: withOrg(organizationId, {
        itemCode: normalized,
        isActive: true,
      }),
    });

    if (itemMatches.length > 1) {
      return {
        ok: false,
        error: `Duplicate item code detected: multiple items match "${normalized}".`,
      };
    }

    if (itemMatches.length === 1) {
      resolvedItem = itemMatches[0];
      resolvedUnitName = resolvedItem.defaultUnit;
      conversionFactor = 1;
      isAlternateUnit = false;
    }
  }

  if (!resolvedItem) {
    return { ok: false, error: `No item found matching barcode "${normalized}".` };
  }

  // Step C: Unit-specific selling price resolution
  let unitPrice = 0;
  if (priceListId) {
    const exactPriceItem = await db.priceListItem.findFirst({
      where: withOrg(organizationId, {
        priceListId,
        itemId: resolvedItem.id,
        unitName: { equals: resolvedUnitName.trim(), mode: "insensitive" },
      }),
      select: { price: true },
    });

    if (exactPriceItem && Number(exactPriceItem.price) >= 0) {
      unitPrice = Number(exactPriceItem.price);
    } else if (isAlternateUnit) {
      const defaultPriceItem = await db.priceListItem.findFirst({
        where: withOrg(organizationId, {
          priceListId,
          itemId: resolvedItem.id,
          unitName: { equals: resolvedItem.defaultUnit.trim(), mode: "insensitive" },
        }),
        select: { price: true },
      });
      if (defaultPriceItem && Number(defaultPriceItem.price) >= 0) {
        unitPrice = Math.round((Number(defaultPriceItem.price) * conversionFactor + Number.EPSILON) * 100) / 100;
      }
    }
  }

  // Step D: Calculate stock for item (in canonical base unit)
  let stockQty = 0;
  if (linkedWarehouseName) {
    const warehouseBatches = await db.itemBatch.findMany({
      where: withOrg(organizationId, {
        itemId: resolvedItem.id,
        availableQty: { gt: 0 },
        warehouseName: { equals: linkedWarehouseName, mode: "insensitive" },
      }),
      select: { availableQty: true },
    });
    stockQty = warehouseBatches.reduce((sum: number, b: any) => sum + Number(b.availableQty || 0), 0);
  }

  if (stockQty <= 0) {
    const allBatches = await db.itemBatch.findMany({
      where: withOrg(organizationId, {
        itemId: resolvedItem.id,
        availableQty: { gt: 0 },
      }),
      select: { availableQty: true },
    });
    const totalBatchStock = allBatches.reduce((sum: number, b: any) => sum + Number(b.availableQty || 0), 0);
    stockQty = totalBatchStock > 0 ? totalBatchStock : Number(resolvedItem.stockOnHand || 0);
  }

  return {
    ok: true,
    item: {
      id: resolvedItem.id,
      name: resolvedItem.name,
      itemCode: resolvedItem.itemCode || "",
      unitName: resolvedUnitName,
      conversionFactor,
      unitPrice,
      stockQty,
      trackBatches: Boolean(resolvedItem.trackBatches),
      hasExpiry: Boolean(resolvedItem.hasExpiry),
      isAlternateUnit,
      barcode: normalized,
    },
  };
}

export async function getPOSListingItems(
  organizationId: string,
  params: {
    posProfileId: string;
    categoryId?: string | null;
    query?: string;
    customerId?: string | null;
  },
  db: any = defaultPrisma
) {
  const { posProfileId, categoryId, query, customerId } = params;

  const profile = await db.pOSProfile.findFirst({
    where: withOrg(organizationId, {
      id: posProfileId,
      isActive: true,
    }),
    include: {
      posCounter: true,
      defaultPriceList: true,
    },
  });
  if (!profile) throw new Error("POS profile not found");

  const linkedWarehouseName = profile.posCounter?.linkedWarehouseName || null;
  let priceListId = profile.defaultPriceListId;

  // Respect customer-specific pricing if selected customer has a designated sellingPriceListId
  if (customerId && customerId !== profile.walkinCustomerId) {
    const customer = await db.party.findFirst({
      where: withOrg(organizationId, { id: customerId }),
      select: { sellingPriceListId: true },
    });
    if (customer?.sellingPriceListId) {
      priceListId = customer.sellingPriceListId;
    }
  }

  if (!priceListId) {
    const fallbackPL = await db.priceList.findFirst({
      where: withOrg(organizationId, {
        isActive: true,
        type: "SELLING",
      }),
      orderBy: [
        { isSystemDefault: "desc" },
        { createdAt: "asc" },
      ],
      select: { id: true },
    });
    if (fallbackPL) priceListId = fallbackPL.id;
  }

  const hideOutOfStock = profile.hideOutOfStockItems;

  let where: any = withOrg(organizationId, {
    isActive: true,
    itemType: "INVENTORY",
  });

  if (categoryId && categoryId !== "all") {
    const cat = await db.itemCategory.findFirst({
      where: withOrg(organizationId, { id: categoryId }),
    });
    if (cat) {
      where.category = cat.name;
    }
  }

  if (query && query.trim()) {
    const q = query.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { itemCode: { contains: q, mode: "insensitive" } },
    ];
  }

  let items = await db.item.findMany({
    where,
    select: {
      id: true,
      name: true,
      itemCode: true,
      defaultUnit: true,
      category: true,
      trackBatches: true,
      hasExpiry: true,
    },
    orderBy: { name: "asc" },
  });

  const itemIds = items.map((i: any) => i.id);

  let linkedStockMap: Record<string, number> = {};
  let overallStockMap: Record<string, number> = {};
  const anyBatchesAtAllRaw = await db.itemBatch.groupBy({
    by: ["warehouseName"],
    where: withOrg(organizationId, { availableQty: { gt: 0 } }),
    _count: { _all: true },
  });
  const anyBatchesAtAll = anyBatchesAtAllRaw.length > 0;

  const normWh = (value: string | null | undefined) =>
    value == null ? "" : String(value).trim().toLowerCase();

  const allBatchesForItems = await db.itemBatch.findMany({
    where: withOrg(organizationId, {
      availableQty: { gt: 0 },
      itemId: { in: itemIds },
    }),
    select: {
      itemId: true,
      warehouseName: true,
      availableQty: true,
    },
  });

  const targetNorm = linkedWarehouseName ? normWh(linkedWarehouseName) : "";
  for (const b of allBatchesForItems) {
    const qty = Number(b.availableQty || 0);
    if (qty <= 0) continue;
    overallStockMap[b.itemId] = Number(overallStockMap[b.itemId] || 0) + qty;
    if (linkedWarehouseName && targetNorm && normWh(b.warehouseName) === targetNorm) {
      linkedStockMap[b.itemId] = Number(linkedStockMap[b.itemId] || 0) + qty;
    }
  }

  if (linkedWarehouseName && Object.keys(linkedStockMap).length === 0) {
    const allStock = await db.itemBatch.groupBy({
      by: ["itemId"],
      where: withOrg(organizationId, {
        availableQty: { gt: 0 },
        itemId: { in: itemIds },
      }),
      _sum: { availableQty: true },
    });
    for (const agg of allStock) {
      overallStockMap[agg.itemId] = Number(overallStockMap[agg.itemId] || 0) + Number(agg._sum.availableQty || 0);
    }
  }

  // Explicitly map prices by itemId:normalizedUnitName
  const priceMap = new Map<string, number>();
  if (priceListId) {
    const priceItems = await db.priceListItem.findMany({
      where: withOrg(organizationId, {
        priceListId,
        itemId: { in: itemIds },
      }),
      select: { itemId: true, unitName: true, price: true },
    });
    for (const p of priceItems) {
      const u = String(p.unitName || "").trim().toLowerCase();
      priceMap.set(`${p.itemId}:${u}`, Number(p.price || 0));
    }
  }

  let barcodeMap: Record<string, string> = {};
  if (query && query.trim()) {
    const q = query.trim();
    const convs = await db.itemUnitConversion.findMany({
      where: withOrg(organizationId, {
        barcode: { contains: q, mode: "insensitive" },
      }),
      select: { itemId: true, barcode: true },
    });
    for (const c of convs) {
      barcodeMap[c.itemId] = c.barcode || "";
    }
    const matchedIds = new Set(convs.map((c: any) => c.itemId));
    if (matchedIds.size > 0) {
      const extraItems = await db.item.findMany({
        where: withOrg(organizationId, {
          id: { in: Array.from(matchedIds).filter((x) => !itemIds.includes(x)) },
          isActive: true,
          itemType: "INVENTORY",
        }),
        select: {
          id: true,
          name: true,
          itemCode: true,
          defaultUnit: true,
          category: true,
          trackBatches: true,
          hasExpiry: true,
        },
      });
      items = [...items, ...extraItems];
    }
  }

  const result = items
    .map((item: any) => {
      const linkedStock = linkedWarehouseName ? Number(linkedStockMap[item.id] || 0) : 0;
      const overallStock = Number(overallStockMap[item.id] || 0);
      const stockQty = linkedStock > 0 ? linkedStock : overallStock;
      const normDefUnit = String(item.defaultUnit || "").trim().toLowerCase();
      const defaultUnitPrice = priceMap.get(`${item.id}:${normDefUnit}`);
      const unitPrice = defaultUnitPrice !== undefined ? Number(defaultUnitPrice) : 0;
      return {
        id: item.id,
        name: item.name,
        itemCode: item.itemCode || "",
        unitName: item.defaultUnit,
        stockQty,
        unitPrice,
        trackBatches: Boolean(item.trackBatches),
        hasExpiry: Boolean(item.hasExpiry),
        categoryId: item.category || null,
        barcode: barcodeMap[item.id] || item.itemCode || "",
      };
    })
    .filter((row: any) => {
      if (!hideOutOfStock) return true;
      if (!anyBatchesAtAll) return true;
      return row.stockQty > 0;
    });

  return result;
}
