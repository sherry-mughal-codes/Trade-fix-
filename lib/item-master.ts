export type ItemUnitConversionInput = {
  id?: string;
  unitName: string;
  conversionFactor: number;
  barcode: string;
};

export function normalizeBarcode(value: string | null | undefined): string {
  return String(value || "").trim();
}

export function normalizeItemType(value: string | null | undefined) {
  return String(value || "INVENTORY").toUpperCase() === "NON_INVENTORY" ? "NON_INVENTORY" : "INVENTORY";
}

export function parseItemUnitConversions(
  raw: string | null | undefined,
  defaultUnit: string,
  itemCode?: string | null,
) {
  if (!raw) return [] as ItemUnitConversionInput[];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Unit conversions data is invalid.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Unit conversions data is invalid.");
  }

  const normalizedDefaultUnit = String(defaultUnit || "").trim().toUpperCase();
  const normalizedItemCode = normalizeBarcode(itemCode);

  const normalizedUnits = parsed
    .map((entry) => {
      const id = typeof (entry as any)?.id === "string" ? String((entry as any).id) : undefined;
      const unitName = String((entry as any)?.unitName || "").trim();
      const conversionFactor = Number((entry as any)?.conversionFactor || 0);
      const barcode = normalizeBarcode((entry as any)?.barcode);
      return { id, unitName, conversionFactor, barcode };
    })
    .filter((entry) => entry.unitName || entry.barcode);

  const seenUnits = new Set<string>();
  const seenBarcodes = new Set<string>();

  for (const unit of normalizedUnits) {
    if (!unit.unitName) {
      throw new Error("Unit name is required for each alternate unit.");
    }

    const normalizedName = unit.unitName.toUpperCase();
    if (normalizedName === normalizedDefaultUnit) {
      throw new Error("Alternate unit cannot match the default unit.");
    }
    if (seenUnits.has(normalizedName)) {
      throw new Error(`Duplicate alternate unit '${unit.unitName}' is not allowed.`);
    }
    if (!(unit.conversionFactor > 0)) {
      throw new Error(`Conversion factor for '${unit.unitName}' must be greater than zero.`);
    }
    if (!unit.barcode) {
      throw new Error(`Barcode is mandatory for alternate unit '${unit.unitName}'.`);
    }
    if (normalizedItemCode && unit.barcode === normalizedItemCode) {
      throw new Error(`Alternate unit barcode '${unit.barcode}' cannot match the Item Code.`);
    }
    if (seenBarcodes.has(unit.barcode)) {
      throw new Error(`Duplicate alternate unit barcode '${unit.barcode}' is not allowed.`);
    }

    seenUnits.add(normalizedName);
    seenBarcodes.add(unit.barcode);
  }

  return normalizedUnits;
}

export async function findOrCreateInvoiceItem(
  tx: any,
  organizationId: string,
  description: string,
) {
  const name = String(description || "").trim();
  if (!name) return null;

  const existingItem = await tx.item.findFirst({
    where: { organizationId, name },
  });

  if (existingItem) {
    return existingItem;
  }

  return tx.item.create({
    data: {
      organizationId,
      name,
      description: name,
      defaultUnit: "Unit",
      itemType: "NON_INVENTORY",
      trackBatches: false,
      hasExpiry: false,
    },
  });
}
