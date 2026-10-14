const BLOCKED_INVOICE_STATUSES = ["DRAFT", "CANCELLED"];

export function normalizePartyType(type: string | null | undefined) {
  const normalized = String(type || "CUSTOMER").trim().toUpperCase();
  if (normalized === "SUPPLIER" || normalized === "BOTH") {
    return normalized;
  }
  return "CUSTOMER";
}

export function getAllowedPartyTypes(invoiceType: string) {
  return invoiceType === "PURCHASE" ? ["SUPPLIER", "BOTH"] : ["CUSTOMER", "BOTH"];
}

export async function assertPartyMatchesInvoiceType(
  tx: any,
  organizationId: string,
  partyId: string,
  invoiceType: string,
) {
  const party = await tx.party.findFirst({
    where: { id: partyId, organizationId },
    select: {
      id: true,
      name: true,
      type: true,
      creditLimit: true,
      creditDays: true,
      creditStatus: true,
      allowCreditOverride: true,
    },
  });

  if (!party) {
    throw new Error("Selected party was not found.");
  }

  const normalizedType = normalizePartyType(party.type);
  if (!getAllowedPartyTypes(invoiceType).includes(normalizedType)) {
    throw new Error(
      invoiceType === "PURCHASE"
        ? `${party.name} is not configured as a supplier.`
        : `${party.name} is not configured as a customer.`,
    );
  }

  return {
    ...party,
    type: normalizedType,
  };
}

export async function getPartyExposure(
  tx: any,
  organizationId: string,
  partyId: string,
  excludeInvoiceId?: string,
) {
  const aggregate = await tx.invoice.aggregate({
    where: {
      organizationId,
      partyId,
      type: "SALE",
      status: { notIn: BLOCKED_INVOICE_STATUSES },
      balanceAmount: { gt: 0 },
      ...(excludeInvoiceId ? { id: { not: excludeInvoiceId } } : {}),
    },
    _sum: {
      balanceAmount: true,
    },
  });

  return Number(aggregate._sum.balanceAmount || 0);
}

export async function enforceCustomerCreditLimit(
  tx: any,
  organizationId: string,
  partyId: string,
  incomingExposure: number,
  excludeInvoiceId?: string,
) {
  const party = await assertPartyMatchesInvoiceType(tx, organizationId, partyId, "SALE");
  const currentExposure = await getPartyExposure(tx, organizationId, partyId, excludeInvoiceId);
  const totalExposure = currentExposure + incomingExposure;

  if (party.creditStatus === "ON_HOLD" && !party.allowCreditOverride) {
    throw new Error(`${party.name} is on credit hold.`);
  }

  if (party.creditLimit > 0 && !party.allowCreditOverride && totalExposure > party.creditLimit + 0.0001) {
    const available = Math.max(party.creditLimit - currentExposure, 0);
    throw new Error(
      `${party.name} exceeds credit limit. Limit: ${party.creditLimit.toFixed(2)}, current exposure: ${currentExposure.toFixed(2)}, available: ${available.toFixed(2)}.`,
    );
  }

  return {
    ...party,
    currentExposure,
    totalExposure,
    availableCredit: party.creditLimit > 0 ? Math.max(party.creditLimit - totalExposure, 0) : null,
  };
}
