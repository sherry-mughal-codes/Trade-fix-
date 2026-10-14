"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/rbac";
import { requireOrganizationId, requireOwnedRecord, withOrganization } from "@/lib/tenant-db";
import { normalizePartyType } from "@/lib/credit-control";
import { ActionResult, withActionError } from "@/lib/action-result";
import { AppError } from "@/lib/errors";

type PartyMode = "CUSTOMER" | "SUPPLIER";

function getPartyTypeFromForm(formData: FormData, mode: PartyMode) {
  const allowedTypes = mode === "SUPPLIER" ? ["SUPPLIER", "BOTH"] : ["CUSTOMER", "BOTH"];
  const submittedType = normalizePartyType(String(formData.get("partyType") || mode));
  return allowedTypes.includes(submittedType) ? submittedType : mode;
}

function getListPath(mode: PartyMode) {
  return mode === "SUPPLIER" ? "/suppliers" : "/customers";
}

function getLabel(mode: PartyMode) {
  return mode === "SUPPLIER" ? "Supplier" : "Customer";
}

async function savePartyCore(mode: PartyMode, formData: FormData, existingId?: string): Promise<{ success: true; redirectUrl?: string; id?: string }> {
  const createPermission = "customers.create";
  const editPermission = "customers.action.edit";
  const isAllowed = existingId ? await hasPermission(editPermission) : await hasPermission(createPermission);
  if (!isAllowed) throw AppError.forbidden(existingId ? editPermission : createPermission);

  const organizationId = await requireOrganizationId();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim() || null;
  const phone = String(formData.get("phone") || "").trim() || null;
  const address = String(formData.get("address") || "").trim() || null;
  const currency = String(formData.get("currency") || "PKR");
  const ntn = String(formData.get("ntn") || "").trim() || null;
  const strn = String(formData.get("strn") || "").trim() || null;
  const contactPerson = String(formData.get("contactPerson") || "").trim() || null;
  const companyTypeId = String(formData.get("companyTypeId") || "").trim() || null;
  const partyType = getPartyTypeFromForm(formData, mode);
  const isActive = String(formData.get("isActive") || "true") !== "false";
  const creditLimit = Math.max(parseFloat(String(formData.get("creditLimit") || "0")) || 0, 0);
  const creditDays = Math.max(parseInt(String(formData.get("creditDays") || "0"), 10) || 0, 0);
  const creditStatus = String(formData.get("creditStatus") || "ACTIVE").toUpperCase() === "ON_HOLD" ? "ON_HOLD" : "ACTIVE";
  const allowCreditOverride = String(formData.get("allowCreditOverride") || "") === "true";
  const sellingPriceListIdRaw = String(formData.get("sellingPriceListId") || "").trim();
  const buyingPriceListIdRaw = String(formData.get("buyingPriceListId") || "").trim();
  const sellingPriceListId = sellingPriceListIdRaw || null;
  const buyingPriceListId = buyingPriceListIdRaw || null;

  if (!name) throw AppError.validation(`${getLabel(mode)} name is required`);

  if (sellingPriceListId) {
    const list = await prisma.priceList.findFirst({
      where: withOrganization(organizationId, { id: sellingPriceListId, type: "SELLING", isActive: true }),
      select: { id: true },
    });
    if (!list) throw AppError.validation("Selling price list is invalid.");
  }

  if (buyingPriceListId) {
    const list = await prisma.priceList.findFirst({
      where: withOrganization(organizationId, { id: buyingPriceListId, type: "BUYING", isActive: true }),
      select: { id: true },
    });
    if (!list) throw AppError.validation("Buying price list is invalid.");
  }

  const existingParty = await prisma.party.findFirst({
    where: withOrganization(organizationId, {
      name,
      ...(existingId ? { id: { not: existingId } } : {}),
    }),
  });

  if (existingParty) throw AppError.duplicate("name", { detail: `${getLabel(mode)} name must be unique` });

  const data: any = {
    name,
    organizationId,
    email,
    phone,
    address,
    currency,
    type: partyType,
    ntn,
    strn,
    contactPerson,
    companyTypeId,
    isActive,
    creditLimit,
    creditDays,
    creditStatus,
    allowCreditOverride,
  };

  if (mode === "CUSTOMER") {
    data.sellingPriceListId = sellingPriceListId;
  }

  if (mode === "SUPPLIER") {
    data.buyingPriceListId = buyingPriceListId;
  }

  if (existingId) {
    await requireOwnedRecord(prisma.party, existingId, organizationId, { recordType: getLabel(mode) });
    await prisma.party.update({
      where: { id: existingId },
      data,
    });
    revalidatePath("/customers");
    revalidatePath("/suppliers");
    return { success: true, redirectUrl: getListPath(mode) };
  }

  const party = await prisma.party.create({
    data,
    select: { id: true },
  });

  revalidatePath("/customers");
  revalidatePath("/suppliers");
  return { success: true, redirectUrl: `${getListPath(mode)}/${party.id}/edit`, id: party.id };
}

async function saveParty(mode: PartyMode, formData: FormData, existingId?: string): Promise<ActionResult<{ redirectUrl?: string; id?: string }>> {
  return withActionError(`saveParty:${mode}${existingId ? `:${existingId}` : ""}`, async () => savePartyCore(mode, formData, existingId));
}

export async function createCustomer(formData: FormData): Promise<ActionResult<{ redirectUrl?: string; id?: string }>> {
  return saveParty("CUSTOMER", formData);
}

export async function updateCustomer(id: string, formData: FormData): Promise<ActionResult<{ redirectUrl?: string; id?: string }>> {
  return saveParty("CUSTOMER", formData, id);
}

async function deletePartyCore(mode: PartyMode, id: string): Promise<void> {
  if (!(await hasPermission("customers.action.delete"))) {
    throw AppError.forbidden("customers.action.delete");
  }
  const organizationId = await requireOrganizationId();
  const label = getLabel(mode);

  const party = await prisma.party.findFirst({
    where: withOrganization(organizationId, { id }),
    include: {
      invoices: true,
      payments: true,
    },
  });

  if (!party) throw AppError.notFound(label, id);
  if (party.invoices.length || party.payments.length) {
    throw AppError.referenceRestricted("delete", label, [
      ...(party.invoices.length ? [{ label: "invoice", count: party.invoices.length }] : []),
      ...(party.payments.length ? [{ label: "payment", count: party.payments.length }] : []),
    ]);
  }

  await prisma.party.delete({ where: { id } });
  revalidatePath("/customers");
  revalidatePath("/suppliers");
}

export async function deleteCustomer(id: string): Promise<ActionResult<void>> {
  return withActionError(`deleteCustomer:${id}`, async (): Promise<void> => deletePartyCore("CUSTOMER", id));
}

export async function createSupplier(formData: FormData): Promise<ActionResult<{ redirectUrl?: string; id?: string }>> {
  return saveParty("SUPPLIER", formData);
}

export async function updateSupplier(id: string, formData: FormData): Promise<ActionResult<{ redirectUrl?: string; id?: string }>> {
  return saveParty("SUPPLIER", formData, id);
}

export async function deleteSupplier(id: string): Promise<ActionResult<void>> {
  return withActionError(`deleteSupplier:${id}`, async (): Promise<void> => deletePartyCore("SUPPLIER", id));
}
