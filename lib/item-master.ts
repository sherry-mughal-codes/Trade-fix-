export type ItemUnitConversionInput = {
  unitName: string;
  conversionFactor: number;
};

export function normalizeItemType(value: string | null | undefined) {
  return String(value || "INVENTORY").toUpperCase() === "NON_INVENTORY" ? "NON_INVENTORY" : "INVENTORY";
}

export function parseItemUnitConversions(raw: string | null | undefined, defaultUnit: string) {
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

  const normalizedUnits = parsed
    .map((entry) => {
      const unitName = String((entry as any)?.unitName || "").trim();
      const conversionFactor = Number((entry as any)?.conversionFactor || 0);
      return { unitName, conversionFactor };
    })
    .filter((entry) => entry.unitName);

  const seenUnits = new Set<string>();

  for (const unit of normalizedUnits) {
    const normalizedName = unit.unitName.toUpperCase();
    if (normalizedName === defaultUnit.toUpperCase()) {
      throw new Error("Alternate unit cannot match the default unit.");
    }
    if (seenUnits.has(normalizedName)) {
      throw new Error("Duplicate alternate units are not allowed.");
    }
    if (!(unit.conversionFactor > 0)) {
      throw new Error("Each alternate unit must have a conversion factor greater than zero.");
    }
    seenUnits.add(normalizedName);
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
