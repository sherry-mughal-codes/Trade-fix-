"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOrganizationId, requireOwnedRecord, withOrganization } from "@/lib/tenant-db";
import { requirePOSProfileAccess } from "./access";
import { getPermissionContext, requirePermission, hasPermission } from "@/lib/rbac";
import { syncInvoiceInventory, rebuildInventoryForItems } from "@/lib/inventory";
import {
  createSequencedJournalEntry,
  getCompanySettings,
  syncInvoiceCommercialJournal,
  syncInvoiceInventoryAccounting,
} from "@/lib/inventory-accounting";
import type { JournalRowInput } from "@/lib/inventory-accounting";
import { AppError } from "@/lib/errors";
import { ActionResult, actionOk, withActionError } from "@/lib/action-result";

export async function createCounter(formData: FormData) {
  await requirePOSProfileAccess();
  const organizationId = await requireOrganizationId();

  const name = String(formData.get("name") || "").trim();
  const code = String(formData.get("code") || "").trim() || null;
  const isActive = String(formData.get("isActive") || "true") !== "false";
  const linkedWarehouseName = String(formData.get("linkedWarehouseName") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!name) return { error: "Counter name is required" };

  const duplicate = await prisma.counterMaster.findFirst({
    where: withOrganization(organizationId, { name }),
  });
  if (duplicate) return { error: "Counter name must be unique" };

  await prisma.counterMaster.create({
    data: {
      organizationId,
      name,
      code,
      isActive,
      linkedWarehouseName,
      notes,
    },
  });

  revalidatePath("/pos");
  revalidatePath("/pos/counters");
  return { success: true, redirectUrl: "/pos/counters" };
}

export async function updateCounter(id: string, formData: FormData) {
  await requirePOSProfileAccess();
  const organizationId = await requireOrganizationId();

  const name = String(formData.get("name") || "").trim();
  const code = String(formData.get("code") || "").trim() || null;
  const isActive = String(formData.get("isActive") || "true") !== "false";
  const linkedWarehouseName = String(formData.get("linkedWarehouseName") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!name) return { error: "Counter name is required" };

  const duplicate = await prisma.counterMaster.findFirst({
    where: withOrganization(organizationId, {
      name,
      id: { not: id },
    }),
  });
  if (duplicate) return { error: "Counter name must be unique" };

  await requireOwnedRecord(prisma.counterMaster as any, id, organizationId);

  await prisma.counterMaster.update({
    where: { id },
    data: {
      name,
      code,
      isActive,
      linkedWarehouseName,
      notes,
    },
  });

  revalidatePath("/pos");
  revalidatePath("/pos/counters");
  return { success: true, redirectUrl: "/pos/counters" };
}

export async function deleteCounter(id: string) {
  await requirePOSProfileAccess();
  const organizationId = await requireOrganizationId();

  await requireOwnedRecord(prisma.counterMaster as any, id, organizationId);

  const inUse = await prisma.pOSProfile.findFirst({
    where: withOrganization(organizationId, { posCounterId: id }),
  });
  if (inUse) throw new Error("Cannot delete counter: it is referenced by a POS profile.");

  const hasShifts = await prisma.cashierShift.findFirst({
    where: withOrganization(organizationId, { posCounterId: id }),
  });
  if (hasShifts) throw new Error("Cannot delete counter: it has linked cashier shifts.");

  const hasInvoices = await prisma.invoice.findFirst({
    where: withOrganization(organizationId, { posCounterId: id }),
  });
  if (hasInvoices) throw new Error("Cannot delete counter: it has linked invoices.");

  await prisma.counterMaster.delete({ where: { id } });

  revalidatePath("/pos");
  revalidatePath("/pos/counters");
}

export async function createPOSProfile(formData: FormData) {
  await requirePOSProfileAccess();
  const organizationId = await requireOrganizationId();

  const name = String(formData.get("name") || "").trim();
  const code = String(formData.get("code") || "").trim() || null;
  const isActive = String(formData.get("isActive") || "true") !== "false";
  const defaultUserId = String(formData.get("defaultUserId") || "").trim() || null;
  const walkinCustomerId = String(formData.get("walkinCustomerId") || "").trim();
  const defaultPriceListId = String(formData.get("defaultPriceListId") || "").trim() || null;
  const defaultPaymentMethod = String(formData.get("defaultPaymentMethod") || "CASH");
  const posCounterId = String(formData.get("posCounterId") || "").trim();
  const defaultCashAccountId = String(formData.get("defaultCashAccountId") || "").trim();
  const defaultBankAccountId = String(formData.get("defaultBankAccountId") || "").trim();
  const allowCreditCheckout = formData.get("allowCreditCheckout") === "on";
  const allowPriceOverride = formData.get("allowPriceOverride") === "on";
  const allowDiscount = formData.get("allowDiscount") !== "off";
  const maxDiscountPct = Number(formData.get("maxDiscountPct") || 5);
  const requireCustomerForCredit = formData.get("requireCustomerForCredit") !== "off";
  const customerQuickCreate = formData.get("customerQuickCreate") !== "off";
  const hideOutOfStockItems = formData.get("hideOutOfStockItems") !== "off";
  const receiptHeader = String(formData.get("receiptHeader") || "").trim() || null;
  const receiptFooter = String(formData.get("receiptFooter") || "").trim() || null;
  const printerName = String(formData.get("printerName") || "").trim() || null;

  if (!name) return { error: "Profile name is required" };
  if (!walkinCustomerId) return { error: "Walk-in customer is required" };
  if (!posCounterId) return { error: "POS counter is required" };
  if (!defaultCashAccountId) return { error: "Default cash account is required" };
  if (!defaultBankAccountId) return { error: "Default bank account is required" };

  const validPayments = ["CASH", "CARD", "BANK", "WALLET"];
  if (!validPayments.includes(defaultPaymentMethod)) return { error: "Invalid default payment method" };

  const duplicate = await prisma.pOSProfile.findFirst({
    where: withOrganization(organizationId, { name }),
  });
  if (duplicate) return { error: "Profile name must be unique" };

  await prisma.pOSProfile.create({
    data: {
      organizationId,
      name,
      code,
      isActive,
      defaultUserId,
      walkinCustomerId,
      defaultPriceListId,
      defaultPaymentMethod,
      posCounterId,
      defaultCashAccountId,
      defaultBankAccountId,
      allowCreditCheckout,
      allowPriceOverride,
      allowDiscount,
      maxDiscountPct,
      requireCustomerForCredit,
      customerQuickCreate,
      hideOutOfStockItems,
      receiptHeader,
      receiptFooter,
      printerName,
    },
  });

  revalidatePath("/pos");
  revalidatePath("/pos/profiles");
  return { success: true, redirectUrl: "/pos/profiles" };
}

export async function updatePOSProfile(id: string, formData: FormData) {
  await requirePOSProfileAccess();
  const organizationId = await requireOrganizationId();

  const name = String(formData.get("name") || "").trim();
  const code = String(formData.get("code") || "").trim() || null;
  const isActive = String(formData.get("isActive") || "true") !== "false";
  const defaultUserId = String(formData.get("defaultUserId") || "").trim() || null;
  const walkinCustomerId = String(formData.get("walkinCustomerId") || "").trim();
  const defaultPriceListId = String(formData.get("defaultPriceListId") || "").trim() || null;
  const defaultPaymentMethod = String(formData.get("defaultPaymentMethod") || "CASH");
  const posCounterId = String(formData.get("posCounterId") || "").trim();
  const defaultCashAccountId = String(formData.get("defaultCashAccountId") || "").trim();
  const defaultBankAccountId = String(formData.get("defaultBankAccountId") || "").trim();
  const allowCreditCheckout = formData.get("allowCreditCheckout") === "on";
  const allowPriceOverride = formData.get("allowPriceOverride") === "on";
  const allowDiscount = formData.get("allowDiscount") !== "off";
  const maxDiscountPct = Number(formData.get("maxDiscountPct") || 5);
  const requireCustomerForCredit = formData.get("requireCustomerForCredit") !== "off";
  const customerQuickCreate = formData.get("customerQuickCreate") !== "off";
  const hideOutOfStockItems = formData.get("hideOutOfStockItems") !== "off";
  const receiptHeader = String(formData.get("receiptHeader") || "").trim() || null;
  const receiptFooter = String(formData.get("receiptFooter") || "").trim() || null;
  const printerName = String(formData.get("printerName") || "").trim() || null;

  if (!name) return { error: "Profile name is required" };
  if (!walkinCustomerId) return { error: "Walk-in customer is required" };
  if (!posCounterId) return { error: "POS counter is required" };
  if (!defaultCashAccountId) return { error: "Default cash account is required" };
  if (!defaultBankAccountId) return { error: "Default bank account is required" };

  const validPayments = ["CASH", "CARD", "BANK", "WALLET"];
  if (!validPayments.includes(defaultPaymentMethod)) return { error: "Invalid default payment method" };

  const duplicate = await prisma.pOSProfile.findFirst({
    where: withOrganization(organizationId, {
      name,
      id: { not: id },
    }),
  });
  if (duplicate) return { error: "Profile name must be unique" };

  await requireOwnedRecord(prisma.pOSProfile as any, id, organizationId);

  await prisma.pOSProfile.update({
    where: { id },
    data: {
      name,
      code,
      isActive,
      defaultUserId,
      walkinCustomerId,
      defaultPriceListId,
      defaultPaymentMethod,
      posCounterId,
      defaultCashAccountId,
      defaultBankAccountId,
      allowCreditCheckout,
      allowPriceOverride,
      allowDiscount,
      maxDiscountPct,
      requireCustomerForCredit,
      customerQuickCreate,
      hideOutOfStockItems,
      receiptHeader,
      receiptFooter,
      printerName,
    },
  });

  revalidatePath("/pos");
  revalidatePath("/pos/profiles");
  return { success: true, redirectUrl: "/pos/profiles" };
}

export async function deletePOSProfile(id: string) {
  await requirePOSProfileAccess();
  const organizationId = await requireOrganizationId();

  await requireOwnedRecord(prisma.pOSProfile as any, id, organizationId);

  const inUseByShift = await prisma.cashierShift.findFirst({
    where: withOrganization(organizationId, { posProfileId: id }),
  });
  if (inUseByShift) throw new Error("Cannot delete profile: it has linked cashier shifts.");

  const inUseByInvoice = await prisma.invoice.findFirst({
    where: withOrganization(organizationId, { posProfileId: id }),
  });
  if (inUseByInvoice) throw new Error("Cannot delete profile: it has linked invoices.");

  const inUseBySaved = await prisma.posSavedOrder.findFirst({
    where: withOrganization(organizationId, { posProfileId: id }),
  });
  if (inUseBySaved) throw new Error("Cannot delete profile: it has saved orders.");

  await prisma.pOSProfile.delete({ where: { id } });

  revalidatePath("/pos");
  revalidatePath("/pos/profiles");
}

function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function random4(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

async function requireShiftOpenAndOwned(tx: any, userId: string, organizationId: string, opts?: { actionHint?: string }) {
  const shifts = await tx.cashierShift.findMany({
    where: withOrganization(organizationId, { userId }),
    orderBy: [{ createdAt: "desc" }],
    take: 5,
  });
  const open = shifts.find((s: any) => s.status === "OPEN");
  if (open) return open;
  const latest = shifts[0];
  if (latest && latest.status !== "OPEN") {
    throw AppError.shiftClosed(latest.shiftNumber ?? null, {
      actionHint: opts?.actionHint ?? "continue trading on this counter",
    });
  }
  throw AppError.shiftRequired({ actionHint: opts?.actionHint ?? "saving orders or checking out" });
}

async function requireProfileOwnedAndActive(profileId: string, organizationId: string, userId: string) {
  const profile = await prisma.pOSProfile.findFirst({
    where: withOrganization(organizationId, {
      id: profileId,
      isActive: true,
    }),
    include: {
      posCounter: true,
    },
  });
  if (!profile) {
    throw new Error("POS profile not found or inactive");
  }
  const canManage = await hasPermission("pos.profile.manage");
  if (!canManage) {
    const counterOpen = await hasPermission("pos.counter.open");
    if (!counterOpen) {
      throw new Error("FORBIDDEN");
    }
    if (profile.defaultUserId && profile.defaultUserId !== userId) {
      throw new Error("This POS profile is not assigned to you");
    }
  }
  return profile;
}

export async function getCurrentShiftContext() {
  const organizationId = await requireOrganizationId();
  const ctx = await getPermissionContext();
  const userId = ctx.userId;
  if (!userId) throw new Error("Not authenticated");

  const canManage = ctx.isSuperadmin || ctx.permissions.includes("pos.profile.manage");
  const counterOpen = ctx.permissions.includes("pos.counter.open");

  let profileWhere: any = withOrganization(organizationId, { isActive: true });
  if (!canManage) {
    profileWhere = {
      ...profileWhere,
      OR: [
        { defaultUserId: userId },
        { defaultUserId: null },
      ],
    };
  }

  const [availableProfiles, openShift, companySettings] = await Promise.all([
    canManage || counterOpen
      ? prisma.pOSProfile.findMany({
          where: profileWhere,
          include: {
            posCounter: true,
            walkinCustomer: true,
            defaultCashAccount: true,
            defaultBankAccount: true,
            defaultPriceList: true,
          },
          orderBy: { name: "asc" },
        })
      : [],
    prisma.cashierShift.findFirst({
      where: withOrganization(organizationId, {
        userId,
        status: "OPEN",
      }),
      include: {
        posProfile: {
          include: {
            posCounter: true,
            walkinCustomer: { select: { id: true, name: true } },
            defaultCashAccount: true,
            defaultBankAccount: true,
            defaultPriceList: true,
          },
        },
      },
    }),
    prisma.companySettings.findFirst({
      where: { organizationId },
    }),
  ]);

  return {
    openShift,
    availableProfiles,
    companySettings,
  };
}

export async function openShift(formData: FormData) {
  await requirePermission("pos.shift.openSelf");
  const organizationId = await requireOrganizationId();
  const ctx = await getPermissionContext();
  const userId = ctx.userId;
  if (!userId) throw new Error("Not authenticated");

  const posProfileId = String(formData.get("posProfileId") || "").trim();
  const openingFloat = Number(formData.get("openingFloat") || 0);

  if (!posProfileId) return { error: "POS profile is required" };

  const profile = await requireProfileOwnedAndActive(posProfileId, organizationId, userId);
  if (!profile.posCounter?.isActive) {
    return { error: "Linked counter is inactive" };
  }

  const existingOpen = await prisma.cashierShift.findFirst({
    where: withOrganization(organizationId, {
      userId,
      status: "OPEN",
    }),
  });
  if (existingOpen) {
    return { error: "You already have an open shift. Close it first." };
  }

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}${mm}${dd}`;

  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

  const shiftsToday = await prisma.cashierShift.count({
    where: withOrganization(organizationId, {
      posProfileId,
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    }),
  });

  const shiftNumber = `SH-${dateStr}-${shiftsToday + 1}`;

  await prisma.cashierShift.create({
    data: {
      organizationId,
      posProfileId,
      userId,
      posCounterId: profile.posCounterId,
      posCounterSnapshot: profile.posCounter.name,
      warehouseName: profile.posCounter.linkedWarehouseName || null,
      counterName: profile.posCounter.name,
      shiftNumber,
      openingFloat,
      status: "OPEN",
      cashExpected: 0,
      cardExpected: 0,
      bankExpected: 0,
      walletExpected: 0,
      creditExpected: 0,
      refundTotal: 0,
      discountTotal: 0,
      billsCount: 0,
      itemsCount: 0,
    },
  });

  revalidatePath("/pos");
  revalidatePath("/register");
  revalidatePath("/pos/reports/x");
  revalidatePath("/pos/reports/z");
  revalidatePath("/pos/shifts");
  return { success: true };
}

async function generateShiftSnapshotsInternal(
  tx: any,
  params: {
    shift: any;
    organizationId: string;
    userId: string;
    userName?: string | null;
    kind: "X" | "Z";
    closing?: {
      closingCash?: number | null;
      closingCard?: number | null;
      closingBank?: number | null;
      closingWallet?: number | null;
      closeNotes?: string | null;
    };
  }
) {
  const { shift, organizationId, userId, userName, kind } = params;
  let closing = params.closing;
  if (kind === "Z" && !closing) {
    closing = {};
  }
  const settings = await getCompanySettings(tx, organizationId);
  const profile = await tx.pOSProfile.findFirst({
    where: withOrganization(organizationId, { id: shift.posProfileId }),
    include: { posCounter: true, defaultCashAccount: true, defaultBankAccount: true },
  });
  if (!profile) throw new Error("POS profile missing");
  const now = new Date();
  const shiftStart = new Date(shift.openedAt);
  const until = kind === "Z" ? now : null;

  const invoices = await tx.invoice.findMany({
    where: withOrganization(organizationId, {
      cashierShiftId: shift.id,
      isPos: true,
      status: { not: "CANCELLED" },
    }),
    include: {
      items: true,
      payments: true,
      party: { select: { name: true } },
    },
  });
  const refunds = await tx.pOSRefund.findMany({
    where: withOrganization(organizationId, { cashierShiftId: shift.id }),
  });

  const grossSales = invoices.reduce((s: number, inv: any) => s + round2(inv.subTotal || 0), 0);
  const discountTotal = invoices.reduce((s: number, inv: any) => s + round2(inv.discountTotal || 0), 0);
  const refundTotal = refunds.reduce((s: number, r: any) => s + round2(r.grandTotal || 0), 0);
  const netSales = round2(grossSales - discountTotal - refundTotal);
  const billsCount = invoices.length;
  const refundCount = refunds.length;
  const itemsCount = invoices.reduce((s: number, inv: any) => s + (inv.items?.length || 0), 0);
  const tenderMap: Record<string, number> = { CASH: 0, CARD: 0, BANK: 0, WALLET: 0, CREDIT: 0 };
  let splitCount = 0;
  for (const inv of invoices) {
    const invPaid = inv.payments || [];
    const isCredit = invPaid.length === 0 && round2(inv.balanceAmount || 0) > 0.001;
    if (isCredit) {
      tenderMap.CREDIT += round2(inv.grandTotal || 0);
      continue;
    }
    if (invPaid.length > 1) splitCount += 1;
    for (const p of invPaid) {
      const m = String(p.method || "CASH").toUpperCase();
      tenderMap[m] = (tenderMap[m] || 0) + round2(Math.abs(Number(p.amount) || 0));
    }
  }
  const cashSales = tenderMap.CASH || 0;
  const cardSales = tenderMap.CARD || 0;
  const bankSales = tenderMap.BANK || 0;
  const walletSales = tenderMap.WALLET || 0;
  const creditSales = tenderMap.CREDIT || 0;
  const openingFloat = round2(shift.openingFloat || 0);
  const cashExpected = round2(openingFloat + cashSales);
  const cardExpected = round2((shift.cardExpected as any) || cardSales);
  const bankExpected = round2((shift.bankExpected as any) || bankSales);
  const walletExpected = round2((shift.walletExpected as any) || walletSales);
  let closingCashCounted: number | null = null;
  let closingCardCounted: number | null = null;
  let closingBankCounted: number | null = null;
  let closingWalletCounted: number | null = null;
  let cashVariance: number | null = null;
  let cardVariance: number | null = null;
  let bankVariance: number | null = null;
  let walletVariance: number | null = null;

  if (kind === "Z") {
    closingCashCounted = closing?.closingCash != null ? Number(closing.closingCash) : null;
    closingCardCounted = closing?.closingCard != null ? Number(closing.closingCard) : null;
    closingBankCounted = closing?.closingBank != null ? Number(closing.closingBank) : null;
    closingWalletCounted = closing?.closingWallet != null ? Number(closing.closingWallet) : null;
    cashVariance = closingCashCounted != null ? round2(closingCashCounted - cashExpected) : null;
    cardVariance = closingCardCounted != null ? round2(closingCardCounted - cardExpected) : null;
    bankVariance = closingBankCounted != null ? round2(closingBankCounted - bankExpected) : null;
    walletVariance = closingWalletCounted != null ? round2(closingWalletCounted - walletExpected) : null;
  }
  const snapshotNumberPrefix = `${kind}-${String(shift.openedAt.getFullYear())}${String(shift.openedAt.getMonth() + 1).padStart(2, "0")}${String(shift.openedAt.getDate()).padStart(2, "0")}-`;
  const existingSameKind = await tx.pOSReportSnapshot.count({
    where: withOrganization(organizationId, { kind, snapshotNumber: { startsWith: snapshotNumberPrefix } }),
  });
  const snapshotNumber = `${snapshotNumberPrefix}${String(existingSameKind + 1).padStart(3, "0")}`;
  const summary = {
    shiftNumber: shift.shiftNumber,
    counterName: shift.counterName || profile.posCounter?.name,
    cashierName: userName || null,
    profileName: profile.name,
    openedAt: shift.openedAt,
    generatedAt: now,
    openingFloat,
    billsCount,
    itemsCount,
    refundCount,
    grossSales,
    discountTotal,
    refundTotal,
    netSales,
    cashSales,
    cardSales,
    bankSales,
    walletSales,
    creditSales,
    splitTenderCount: splitCount,
    cashExpected,
    cardExpected,
    bankExpected,
    walletExpected,
    closingCashCounted,
    closingCardCounted,
    closingBankCounted,
    closingWalletCounted,
    cashVariance,
    cardVariance,
    bankVariance,
    walletVariance,
    totalVariance:
      cashVariance != null ||
      cardVariance != null ||
      bankVariance != null ||
      walletVariance != null
        ? round2(
            Number(cashVariance ?? 0) +
              Number(cardVariance ?? 0) +
              Number(bankVariance ?? 0) +
              Number(walletVariance ?? 0)
          )
        : null,
    closeNotes: closing?.closeNotes || shift.closeNotes || null,
  };
  const tenderDetailMap: Record<
    string,
    {
      sales: number;
      expected: number | null;
      counted: number | null;
      variance: number | null;
    }
  > = {
    CASH: {
      sales: tenderMap.CASH || 0,
      expected: cashExpected,
      counted: closingCashCounted,
      variance: cashVariance,
    },
    CARD: {
      sales: tenderMap.CARD || 0,
      expected: cardExpected,
      counted: closingCardCounted,
      variance: cardVariance,
    },
    BANK: {
      sales: tenderMap.BANK || 0,
      expected: bankExpected,
      counted: closingBankCounted,
      variance: bankVariance,
    },
    WALLET: {
      sales: tenderMap.WALLET || 0,
      expected: walletExpected,
      counted: closingWalletCounted,
      variance: walletVariance,
    },
    CREDIT: {
      sales: tenderMap.CREDIT || 0,
      expected: null,
      counted: null,
      variance: null,
    },
  };
  const lineItems = invoices.map((inv: any) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    customerName: inv.party?.name,
    date: inv.createdAt,
    status: inv.status,
    subTotal: round2(inv.subTotal || 0),
    discountTotal: round2(inv.discountTotal || 0),
    grandTotal: round2(inv.grandTotal || 0),
    paidAmount: round2(inv.paidAmount || 0),
    items: inv.items?.length || 0,
    isCredit: round2(inv.balanceAmount || 0) > 0.001,
  }));
  const categoryAgg: Record<string, { qty: number; amount: number; count: number }> = {};
  for (const inv of invoices) {
    for (const it of inv.items || []) {
      const key = String(it.itemId || "");
      if (!categoryAgg[key]) categoryAgg[key] = { qty: 0, amount: 0, count: 0 };
      categoryAgg[key].qty += Number(it.quantity || 0);
      categoryAgg[key].amount += round2(it.amount || 0);
      categoryAgg[key].count += 1;
    }
  }
  const snapshot = await tx.pOSReportSnapshot.create({
    data: {
      organizationId,
      kind,
      snapshotNumber,
      generatedAt: now,
      cashierShiftId: shift.id,
      posProfileId: shift.posProfileId,
      posCounterId: shift.posCounterId,
      userId,
      openedAt: shiftStart,
      closedAt: until,
      openingFloat,
      billsCount,
      itemsCount,
      refundCount,
      grossSales,
      discountTotal,
      refundTotal,
      netSales,
      cashSales,
      cardSales,
      bankSales,
      walletSales,
      creditSales,
      splitTenderCount: splitCount,
      cashExpected,
      cardExpected,
      bankExpected,
      walletExpected,
      closingCashCounted,
      closingCardCounted,
      closingBankCounted,
      closingWalletCounted,
      cashVariance,
      cardVariance,
      bankVariance,
      walletVariance,
      summaryJson: summary,
      lineItemsJson: lineItems,
      tenderBreakdownJson: tenderDetailMap,
      categoryBreakdownJson: categoryAgg,
      taxBreakdownJson: {},
      closeNotes: closing?.closeNotes || shift.closeNotes || null,
    },
  });

  if (kind === "Z") {
    // Also save an X snapshot representing the shift's closing X-reading
    const xPrefix = `X-${String(shift.openedAt.getFullYear())}${String(shift.openedAt.getMonth() + 1).padStart(2, "0")}${String(shift.openedAt.getDate()).padStart(2, "0")}-`;
    const existingX = await tx.pOSReportSnapshot.count({
      where: withOrganization(organizationId, { kind: "X", snapshotNumber: { startsWith: xPrefix } }),
    });
    const xSnapshotNumber = `${xPrefix}${String(existingX + 1).padStart(3, "0")}`;
    await tx.pOSReportSnapshot.create({
      data: {
        organizationId,
        kind: "X",
        snapshotNumber: xSnapshotNumber,
        generatedAt: now,
        cashierShiftId: shift.id,
        posProfileId: shift.posProfileId,
        posCounterId: shift.posCounterId,
        userId,
        openedAt: shiftStart,
        closedAt: now,
        openingFloat,
        billsCount,
        itemsCount,
        refundCount,
        grossSales,
        discountTotal,
        refundTotal,
        netSales,
        cashSales,
        cardSales,
        bankSales,
        walletSales,
        creditSales,
        splitTenderCount: splitCount,
        cashExpected,
        cardExpected,
        bankExpected,
        walletExpected,
        closingCashCounted,
        closingCardCounted,
        closingBankCounted,
        closingWalletCounted,
        cashVariance,
        cardVariance,
        bankVariance,
        walletVariance,
        summaryJson: summary,
        lineItemsJson: lineItems,
        tenderBreakdownJson: tenderDetailMap,
        categoryBreakdownJson: categoryAgg,
        taxBreakdownJson: {},
        closeNotes: closing?.closeNotes || shift.closeNotes || null,
      },
    });

    await tx.cashierShift.update({
      where: { id: shift.id },
      data: {
        status: "CLOSED",
        closedAt: now,
        closingCashCounted,
        closingCardCounted,
        closingBankCounted,
        closingWalletCounted,
        cashVariance,
        cardVariance,
        bankVariance,
        walletVariance,
        closeNotes: closing?.closeNotes || shift.closeNotes || null,
      },
    });
  }

  return {
    ok: true,
    kind,
    snapshotId: snapshot.id,
    snapshotNumber,
    summary: {
      shiftNumber: shift.shiftNumber,
      openingFloat,
      billsCount,
      itemsCount,
      refundCount,
      grossSales,
      discountTotal,
      refundTotal,
      netSales,
      tenderBreakdown: tenderMap,
      splitTenderCount: splitCount,
      cashExpected,
      cardExpected,
      bankExpected,
      walletExpected,
      cashVariance,
      cardVariance,
      bankVariance,
      walletVariance,
    },
    lineItems,
    shiftClosed: kind === "Z",
  };
}

export async function closeShift(formData: FormData) {
  await requirePermission("pos.shift.closeSelf");
  const organizationId = await requireOrganizationId();
  const ctx = await getPermissionContext();
  const userId = ctx.userId;
  if (!userId) throw new Error("Not authenticated");

  const shiftId = String(formData.get("shiftId") || "").trim();
  const closeNotes = String(formData.get("closeNotes") || "").trim() || null;
  const closingJsonRaw = String(formData.get("closingJson") || "{}").trim();

  let closingJson: any = {};
  try {
    closingJson = JSON.parse(closingJsonRaw);
  } catch {
    closingJson = {};
  }

  const cashClosing = closingJson.cashClosing != null ? Number(closingJson.cashClosing) : null;
  const cardClosing = closingJson.cardClosing != null ? Number(closingJson.cardClosing) : null;
  const bankClosing = closingJson.bankClosing != null ? Number(closingJson.bankClosing) : null;
  const walletClosing = closingJson.walletClosing != null ? Number(closingJson.walletClosing) : null;

  if (!shiftId) return { error: "Shift ID is required" };

  const shift = await prisma.cashierShift.findFirst({
    where: withOrganization(organizationId, { id: shiftId }),
  });
  if (!shift) return { error: "Shift not found" };
  if (shift.userId !== userId) return { error: "You do not own this shift" };
  if (shift.status !== "OPEN") return { error: "Shift is not open" };

  await prisma.$transaction(async (tx: any) => {
    await generateShiftSnapshotsInternal(tx, {
      shift,
      organizationId,
      userId,
      userName: (ctx as any).userName || null,
      kind: "Z",
      closing: {
        closingCash: cashClosing,
        closingCard: cardClosing,
        closingBank: bankClosing,
        closingWallet: walletClosing,
        closeNotes,
      },
    });
  });

  revalidatePath("/pos");
  revalidatePath("/register");
  revalidatePath("/pos/reports/x");
  revalidatePath("/pos/reports/z");
  revalidatePath("/pos/shifts");
  return { success: true };
}

export async function fetchPosItems(params: { posProfileId: string; categoryId?: string | null; query?: string }) {
  await requirePermission("pos.access");
  const organizationId = await requireOrganizationId();
  const ctx = await getPermissionContext();
  const userId = ctx.userId;
  if (!userId) throw new Error("Not authenticated");

  const { posProfileId, categoryId, query } = params;

  const profile = await prisma.pOSProfile.findFirst({
    where: withOrganization(organizationId, {
      id: posProfileId,
      isActive: true,
    }),
    include: {
      posCounter: true,
      defaultPriceList: true,
    },
  });
  if (!profile) throw new Error("POS profile not found");

  await requireOwnedRecord(prisma.pOSProfile as any, posProfileId, organizationId);

  const linkedWarehouseName = profile.posCounter?.linkedWarehouseName || null;
  let priceListId = profile.defaultPriceListId;

  if (!priceListId) {
    const fallbackPL = await prisma.priceList.findFirst({
      where: withOrganization(organizationId, {
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

  let where: any = withOrganization(organizationId, {
    isActive: true,
    itemType: "INVENTORY",
  });

  if (categoryId && categoryId !== "all") {
    const cat = await prisma.itemCategory.findFirst({
      where: withOrganization(organizationId, { id: categoryId }),
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

  let items = await prisma.item.findMany({
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

  const itemIds = items.map((i) => i.id);

  let linkedStockMap: Record<string, number> = {};
  let overallStockMap: Record<string, number> = {};
  const anyBatchesAtAllRaw = await prisma.itemBatch.groupBy({
    by: ["warehouseName"],
    where: withOrganization(organizationId, { availableQty: { gt: 0 } }),
    _count: { _all: true },
  });
  const anyBatchesAtAll = anyBatchesAtAllRaw.length > 0;

  const normWh = (value: string | null | undefined) =>
    value == null ? "" : String(value).trim().toLowerCase();

  const allBatchesForItems = await prisma.itemBatch.findMany({
    where: withOrganization(organizationId, {
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
    const allStock = await prisma.itemBatch.groupBy({
      by: ["itemId"],
      where: withOrganization(organizationId, {
        availableQty: { gt: 0 },
        itemId: { in: itemIds },
      }),
      _sum: { availableQty: true },
    });
    for (const agg of allStock) {
      overallStockMap[agg.itemId] = Number(overallStockMap[agg.itemId] || 0) + Number(agg._sum.availableQty || 0);
    }
  }

  let priceMap: Record<string, number> = {};
  if (priceListId) {
    const priceItems = await prisma.priceListItem.findMany({
      where: withOrganization(organizationId, {
        priceListId,
        itemId: { in: itemIds },
      }),
      select: { itemId: true, price: true },
    });
    for (const p of priceItems) {
      priceMap[p.itemId] = Number(p.price || 0);
    }
  }

  let barcodeMap: Record<string, string> = {};
  if (query && query.trim()) {
    const q = query.trim();
    const convs = await prisma.itemUnitConversion.findMany({
      where: withOrganization(organizationId, {
        barcode: { contains: q, mode: "insensitive" },
      }),
      select: { itemId: true, barcode: true },
    });
    for (const c of convs) {
      barcodeMap[c.itemId] = c.barcode || "";
    }
    const matchedIds = new Set(convs.map((c) => c.itemId));
    if (matchedIds.size > 0) {
      const extraItems = await prisma.item.findMany({
        where: withOrganization(organizationId, {
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
      const unitPrice = Number(priceMap[item.id] ?? 0);
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
    .filter((row) => {
      if (!hideOutOfStock) return true;
      if (!anyBatchesAtAll) return true;
      return row.stockQty > 0;
    });

  return result;
}

export async function getPosCategories(profileId: string) {
  const organizationId = await requireOrganizationId();
  const categories = await prisma.itemCategory.findMany({
    where: withOrganization(organizationId, { isActive: true }),
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return categories.map((c) => ({ ...c, parentId: null }));
}

export async function saveHoldOrder(input: {
  posProfileId: string;
  itemsJson: any;
  totalsJson: any;
  customerId?: string;
  notes?: string;
  existingId?: string;
}): Promise<ActionResult<any>> {
  return withActionError("saveHoldOrder", async () => {
  await requirePermission("pos.sale.saveOrder");
  const organizationId = await requireOrganizationId();
  const ctx = await getPermissionContext();
  const userId = ctx.userId;
  if (!userId) throw new Error("Not authenticated");

  const { posProfileId, itemsJson, totalsJson, customerId, notes, existingId } = input;

  await requireOwnedRecord(prisma.pOSProfile as any, posProfileId, organizationId);

  if (existingId) {
    await requireOwnedRecord(prisma.posSavedOrder as any, existingId, organizationId, {
      where: { userId },
    });
    const updated = await prisma.posSavedOrder.update({
      where: { id: existingId },
      data: {
        itemsJson: JSON.parse(JSON.stringify(itemsJson)),
        totalsJson: JSON.parse(JSON.stringify(totalsJson)),
        customerId: customerId || null,
        notes: notes || null,
      },
    });
    return updated;
  }

  const orderKey = `HOLD-${Date.now()}-${random4()}`;

  const saved = await prisma.posSavedOrder.create({
    data: {
      organizationId,
      posProfileId,
      userId,
      orderKey,
      status: "ACTIVE",
      customerId: customerId || null,
      itemsJson: JSON.parse(JSON.stringify(itemsJson)),
      totalsJson: JSON.parse(JSON.stringify(totalsJson)),
      notes: notes || null,
    },
  });

  return saved;
  });
}

export async function getHoldOrdersList(posProfileId: string) {
  const organizationId = await requireOrganizationId();
  const ctx = await getPermissionContext();
  const userId = ctx.userId;
  if (!userId) throw new Error("Not authenticated");

  const orders = await prisma.posSavedOrder.findMany({
    where: withOrganization(organizationId, {
      posProfileId,
      userId,
      status: "ACTIVE",
    }),
    include: {
      customer: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return orders.map((o: any) => {
    const itemsArr = Array.isArray(o.itemsJson) ? o.itemsJson : [];
    const totals = o.totalsJson && typeof o.totalsJson === "object" ? o.totalsJson : {};
    return {
      id: o.id,
      orderKey: o.orderKey,
      customerName: o.customer?.name || "Walk-in",
      grandTotal: Number(totals.grandTotal || 0),
      itemCount: itemsArr.length,
      updatedAt: o.updatedAt,
    };
  });
}

export async function loadHoldOrder(id: string) {
  const organizationId = await requireOrganizationId();
  const ctx = await getPermissionContext();
  const userId = ctx.userId;
  if (!userId) throw new Error("Not authenticated");

  const order = await prisma.posSavedOrder.findFirst({
    where: withOrganization(organizationId, {
      id,
      userId,
      status: "ACTIVE",
    }),
  });
  if (!order) throw new Error("Saved order not found");
  return order;
}

export async function deleteHoldOrder(id: string) {
  const organizationId = await requireOrganizationId();
  const ctx = await getPermissionContext();
  const userId = ctx.userId;
  if (!userId) throw new Error("Not authenticated");

  const order = await prisma.posSavedOrder.findFirst({
    where: withOrganization(organizationId, { id, userId }),
  });
  if (!order) throw new Error("Saved order not found");

  await prisma.posSavedOrder.delete({ where: { id } });
  return { success: true };
}

export async function posCheckout(payload: {
  posProfileId: string;
  customerId?: string;
  lines: Array<{
    itemId: string;
    itemName: string;
    unitName: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    warehouseName: string;
    batchNumber?: string;
    expiryDate?: string | null;
    itemBatchId?: string | null;
  }>;
  tender: {
    mode: "CASH" | "CARD" | "BANK" | "WALLET" | "CREDIT" | "SPLIT";
    cashAccountId?: string;
    bankAccountId?: string;
    splits?: Array<{
      method: "CASH" | "CARD" | "BANK" | "WALLET";
      amount: number;
      accountId?: string;
      reference?: string;
      methodCardType?: string | null;
    }>;
  };
  cartDiscount?: number;
  savedOrderId?: string;
  notes?: string;
  isCredit: boolean;
  completeAction: "NEW_ORDER" | "PRINT";
}): Promise<ActionResult<any>> {
  return withActionError("posCheckout", async () => {
  await requirePermission("pos.sale.checkout");
  const organizationId = await requireOrganizationId();
  const ctx = await getPermissionContext();
  const userId = ctx.userId;
  if (!userId) throw new Error("Not authenticated");

  const { posProfileId, lines, tender, cartDiscount, savedOrderId, notes, isCredit, completeAction } = payload;
  let { customerId } = payload;

  if (!lines || lines.length === 0) {
    return { ok: false, error: "Cart is empty" };
  }

  const result = await prisma.$transaction(async (tx: any) => {
    const shift = await requireShiftOpenAndOwned(tx, userId, organizationId, {
      actionHint: "completing the checkout",
    });

    const profile = await tx.pOSProfile.findFirst({
      where: withOrganization(organizationId, { id: posProfileId, isActive: true }),
      include: {
        posCounter: true,
        walkinCustomer: true,
        defaultCashAccount: true,
        defaultBankAccount: true,
      },
    });
    if (!profile) throw new Error("POS profile not found");
    if (profile.defaultUserId && profile.defaultUserId !== userId && !ctx.isSuperadmin && !ctx.permissions.includes("pos.profile.manage")) {
      throw new Error("Profile not assigned to you");
    }

    const settings = await tx.companySettings.findFirst({
      where: { organizationId },
    });
    if (!settings) throw new Error("Company settings not found");

    if (isCredit) {
      if (!customerId || customerId === profile.walkinCustomerId) {
        throw new Error("Credit sales require a real customer (not walk-in)");
      }
      if (!ctx.permissions.includes("pos.sale.creditCheckout")) {
        throw new Error("FORBIDDEN: Credit checkout not allowed");
      }
    } else {
      if (!customerId) {
        customerId = profile.walkinCustomerId;
      }
    }

    const party = await tx.party.findFirst({
      where: withOrganization(organizationId, { id: customerId, isActive: true }),
    });
    if (!party) throw new Error("Customer not found");
    const partyType = String(party.type || "CUSTOMER").toUpperCase();
    if (partyType !== "CUSTOMER" && partyType !== "BOTH") {
      throw new Error("Party must be a customer");
    }

    const counter = profile.posCounter;
    const defaultWarehouse = counter?.linkedWarehouseName || null;

    const subTotal = lines.reduce((s, l) => s + round2(Number(l.quantity) * Number(l.unitPrice)), 0);
    const discountLines = lines.reduce((s, l) => s + round2(Number(l.discount) || 0), 0);
    const cartDisc = round2(Number(cartDiscount) || 0);
    const totalDiscount = round2(discountLines + cartDisc);
    const grandTotal = round2(subTotal - totalDiscount);
    const currency = settings.baseCurrency || "PKR";
    const exchangeRate = 1;
    const baseGrandTotal = grandTotal;
    const balanceAmount = isCredit ? grandTotal : 0;
    const paidAmount = isCredit ? 0 : grandTotal;

    const posPrefix = settings.posInvoicePrefix || "POS-";
    const posCurrNum = settings.posCurrentNumber || 1;
    const invoiceNumber = `${posPrefix}${posCurrNum.toString().padStart(5, "0")}`;

    await tx.companySettings.update({
      where: { id: settings.id },
      data: { posCurrentNumber: { increment: 1 } },
    });

    const resolvedItems = await tx.item.findMany({
      where: withOrganization(organizationId, {
        id: { in: lines.map((l) => l.itemId) },
      }),
      select: { id: true, name: true },
    });
    const itemMap: Record<string, any> = {};
    for (const it of resolvedItems) itemMap[it.id] = it;

    const invoiceItems = lines.map((line) => {
      const qty = Number(line.quantity);
      const up = Number(line.unitPrice);
      const lineDisc = round2(Number(line.discount) || 0);
      const amount = round2(qty * up - lineDisc);
      const item = itemMap[line.itemId];
      const warehouse = line.warehouseName || shift.warehouseName || defaultWarehouse;
      return {
        itemId: line.itemId,
        description: item?.name || line.itemName,
        moreDetails: line.unitName || null,
        batchNumber: line.batchNumber || null,
        expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
        warehouseName: warehouse || null,
        itemBatchId: line.itemBatchId || null,
        quantity: qty,
        unitPrice: up,
        discount: lineDisc,
        amount,
      };
    });

    const totalQty = lines.reduce((s, l) => s + Number(l.quantity || 0), 0);

    const invoice = await tx.invoice.create({
      data: {
        organizationId,
        invoiceNumber,
        type: "SALE",
        isPos: true,
        posProfileId,
        posCounterId: profile.posCounterId,
        posCounterSnapshot: counter?.name || null,
        cashierShiftId: shift.id,
        date: new Date(),
        dueDate: null,
        partyId: customerId,
        currency,
        exchangeRate,
        subTotal: round2(subTotal),
        discountTotal: totalDiscount,
        grandTotal,
        baseGrandTotal,
        paidAmount,
        balanceAmount,
        status: isCredit ? "SENT" : "PAID",
        notes: notes || null,
        receiptPrintedCount: completeAction === "PRINT" ? 1 : 0,
        holdKey: null,
        items: {
          create: invoiceItems,
        },
      },
      select: { id: true, invoiceNumber: true },
    });

    let cashAdd = 0, cardAdd = 0, bankAdd = 0, walletAdd = 0, creditAdd = 0;

    if (!isCredit) {
      let splits: Array<{ method: "CASH" | "CARD" | "BANK" | "WALLET"; amount: number; accountId?: string; reference?: string }> = [];

      if (tender.mode === "SPLIT" && tender.splits && tender.splits.length > 0) {
        splits = tender.splits.map((s) => ({
          method: s.method,
          amount: Number(s.amount),
          accountId: s.accountId,
          reference: s.reference,
        }));
      } else {
        const method = tender.mode as "CASH" | "CARD" | "BANK" | "WALLET";
        splits.push({
          method,
          amount: grandTotal,
          accountId: method === "CASH" ? tender.cashAccountId : method === "BANK" ? tender.bankAccountId : undefined,
        });
      }

      for (const split of splits) {
        if (split.amount <= 0) continue;

        const payPrefix = settings.paymentPrefix || "PAY-";
        const payCurrNum = (await tx.companySettings.findFirst({ where: { id: settings.id } }))?.paymentCurrentNumber || 1;
        const paymentNumber = `${payPrefix}${payCurrNum.toString().padStart(4, "0")}`;

        let accountId = "";
        if (split.method === "CASH") {
          accountId = split.accountId || profile.defaultCashAccountId;
          cashAdd += split.amount;
        } else if (split.method === "BANK") {
          accountId = split.accountId || profile.defaultBankAccountId;
          bankAdd += split.amount;
        } else if (split.method === "CARD") {
          accountId = split.accountId || profile.defaultBankAccountId;
          cardAdd += split.amount;
        } else if (split.method === "WALLET") {
          accountId = split.accountId || profile.defaultCashAccountId;
          walletAdd += split.amount;
        }

        if (!accountId) throw new Error(`No account specified for ${split.method}`);

        const payment = await tx.payment.create({
          data: {
            organizationId,
            paymentNumber,
            type: "RECEIVE",
            partyId: customerId,
            amount: split.amount,
            date: new Date(),
            method: split.method,
            reference: split.reference || null,
            invoiceId: invoice.id,
            currency,
            exchangeRate,
          },
        });

        await tx.companySettings.update({
          where: { id: settings.id },
          data: { paymentCurrentNumber: { increment: 1 } },
        });

        let arAccountId = "";
        if (settings.defaultReceivableAccount) {
          const acc = await tx.account.findFirst({
            where: withOrganization(organizationId, {
              OR: [{ id: settings.defaultReceivableAccount }, { name: settings.defaultReceivableAccount }],
            }),
          });
          if (acc) arAccountId = acc.id;
        }
        if (!arAccountId) {
          const acc = await tx.account.findFirst({
            where: withOrganization(organizationId, { name: "Accounts Receivable" }),
          });
          if (acc) arAccountId = acc.id;
        }
        if (!arAccountId) throw new Error("Accounts Receivable account not configured");

        const jrnPrefix = settings.journalPrefix || "JRN-";
        const settings2 = await tx.companySettings.findFirst({ where: { id: settings.id } });
        const jrnCurrNum = settings2?.journalCurrentNumber || 1;
        const entryNumber = `${jrnPrefix}${(jrnCurrNum + 1).toString().padStart(4, "0")}`;

        const baseAmount = split.amount * exchangeRate;

        await tx.journalEntry.create({
          data: {
            organizationId,
            entryNumber,
            date: new Date(),
            description: `POS payment for invoice ${invoice.invoiceNumber} via ${split.method}`,
            reference: paymentNumber,
            currency,
            exchangeRate,
            payment: { connect: { id: payment.id } },
            rows: {
              create: [
                {
                  organizationId,
                  accountId,
                  debit: baseAmount,
                  credit: 0,
                  foreignDebit: split.amount,
                  foreignCredit: 0,
                  description: `${split.method} received`,
                },
                {
                  organizationId,
                  accountId: arAccountId,
                  debit: 0,
                  credit: baseAmount,
                  foreignDebit: 0,
                  foreignCredit: split.amount,
                  description: `AR offset for ${invoice.invoiceNumber}`,
                },
              ],
            },
          },
        });

        await tx.companySettings.update({
          where: { id: settings.id },
          data: { journalCurrentNumber: jrnCurrNum + 1 },
        });
      }

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: grandTotal,
          balanceAmount: 0,
          status: "PAID",
        },
      });
    } else {
      creditAdd = grandTotal;
    }

    await tx.cashierShift.update({
      where: { id: shift.id },
      data: {
        cashExpected: { increment: cashAdd },
        cardExpected: { increment: cardAdd },
        bankExpected: { increment: bankAdd },
        walletExpected: { increment: walletAdd },
        creditExpected: { increment: creditAdd },
        billsCount: { increment: 1 },
        itemsCount: { increment: Math.round(totalQty) },
        discountTotal: { increment: totalDiscount },
      },
    });

    await syncInvoiceInventory(tx, organizationId, invoice.id);
    await syncInvoiceCommercialJournal(tx, organizationId, invoice.id);
    await syncInvoiceInventoryAccounting(tx, organizationId, invoice.id);

    if (savedOrderId) {
      await tx.posSavedOrder.deleteMany({
        where: withOrganization(organizationId, {
          id: savedOrderId,
          userId,
        }),
      });
    }

    return {
      ok: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      grandTotal,
      isCredit,
      needPrint: completeAction === "PRINT",
    };
  });

  revalidatePath("/pos");
  return result;
  });
}

export async function listCustomersForPOS(search?: string) {
  await requirePOSProfileAccess();
  const organizationId = await requireOrganizationId();
  const q = String(search || "").trim();
  const where: any = withOrganization(organizationId, {
    type: { in: ["CUSTOMER", "BOTH"] },
  });
  if (q) {
    where.name = { contains: q, mode: "insensitive" };
  }
  const rows = await prisma.party.findMany({
    where,
    orderBy: { name: "asc" },
    take: 100,
    select: { id: true, name: true },
  });
  return rows as { id: string; name: string }[];
}

export async function createQuickCustomerPOS(name: string) {
  await requirePOSProfileAccess();
  const organizationId = await requireOrganizationId();
  const cleanName = String(name || "").trim();
  if (!cleanName) return { error: "Customer name is required" };
  const created = await prisma.party.create({
    data: {
      organizationId,
      type: "CUSTOMER",
      name: cleanName,
      creditStatus: "ACTIVE",
    },
    select: { id: true, name: true },
  });
  revalidatePath("/pos");
  return { ok: true, customer: { id: created.id, name: created.name } };
}

export async function getTodaysOrdersList(shiftId: string) {
  await requirePOSProfileAccess();
  const organizationId = await requireOrganizationId();
  const shift = await prisma.cashierShift.findFirst({
    where: withOrganization(organizationId, { id: shiftId }),
    select: { id: true },
  });
  if (!shift) return [];
  const invoices = await prisma.invoice.findMany({
    where: withOrganization(organizationId, {
      cashierShiftId: shift.id,
      isPos: true,
      status: { not: "CANCELLED" },
    }),
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      party: { select: { name: true } },
      payments: { select: { amount: true, method: true } },
      items: { select: { id: true } },
    },
  });
  return invoices.map((inv: any) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    date: inv.createdAt,
    customerName: inv.party?.name || "Walk-in Customer",
    itemsCount: inv.items?.length || 0,
    grandTotal: Number(inv.grandTotal || 0),
    paidAmount: Number(inv.paidAmount || 0),
    status: inv.status,
    isCredit: Boolean(inv.balanceAmount && Number(inv.balanceAmount) > 0.001),
  }));
}

export async function searchPOSInvoicesForRefund(params: {
  query?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}) {
  await requirePOSProfileAccess();
  const organizationId = await requireOrganizationId();
  const q = String(params.query || "").trim();
  const take = Math.min(Math.max(Number(params.limit) || 50, 1), 200);
  const where: any = withOrganization(organizationId, {
    isPos: true,
    status: { not: "CANCELLED" },
  });
  const OR: any[] = [];
  if (q) {
    OR.push({ invoiceNumber: { contains: q, mode: "insensitive" } });
    OR.push({ party: { name: { contains: q, mode: "insensitive" } } });
    OR.push({ party: { phone: { contains: q, mode: "insensitive" } } });
    OR.push({ party: { ntn: { contains: q, mode: "insensitive" } } });
    OR.push({ items: { some: { description: { contains: q, mode: "insensitive" } } } });
    if (q.toLowerCase().includes("walk")) {
      OR.push({ partyId: null });
      OR.push({ party: { name: { contains: "walk", mode: "insensitive" } } });
    }
  }
  if (OR.length > 0) where.OR = OR;
  const fromStr = String(params.fromDate || "").trim();
  const toStr = String(params.toDate || "").trim();
  const createdAtRange: any = {};
  if (fromStr) {
    const d = new Date(fromStr);
    if (!Number.isNaN(d.getTime())) createdAtRange.gte = d;
  } else {
    const d60 = new Date();
    d60.setDate(d60.getDate() - 60);
    createdAtRange.gte = d60;
  }
  if (toStr) {
    const d = new Date(toStr);
    if (!Number.isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      createdAtRange.lte = d;
    }
  }
  if (Object.keys(createdAtRange).length > 0) where.createdAt = createdAtRange;
  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    include: {
      party: { select: { id: true, name: true, phone: true } },
      payments: { select: { id: true, amount: true, method: true, reference: true } },
      items: {
        select: {
          id: true,
          itemId: true,
          description: true,
          quantity: true,
          unitPrice: true,
          discount: true,
          amount: true,
          batchNumber: true,
          expiryDate: true,
          warehouseName: true,
          itemBatchId: true,
        },
      },
      posRefunds: {
        where: { status: "ISSUED" },
        select: {
          id: true,
          refundNumber: true,
          grandTotal: true,
          linesJson: true,
          createdAt: true,
        },
      },
    },
  });

  const results: any[] = [];
  for (const inv of invoices) {
    const totalRefunded = (inv.posRefunds || []).reduce((s: number, r: any) => s + round2(r.grandTotal || 0), 0);
    const grandTotal = Number(inv.grandTotal || 0);
    const remainingRefundableAmount = round2(Math.max(0, grandTotal - totalRefunded));

    const refundedQtyByItem: Record<string, number> = {};
    for (const r of inv.posRefunds || []) {
      const rLines = Array.isArray(r.linesJson) ? (r.linesJson as any[]) : [];
      for (const rl of rLines) {
        if (!rl || typeof rl !== "object") continue;
        const key = String((rl as any).itemId || (rl as any).description || "");
        refundedQtyByItem[key] = (refundedQtyByItem[key] || 0) + Number((rl as any).quantity || 0);
      }
    }

    const refundableItems = (inv.items || []).map((it: any) => {
      const key = String(it.itemId || it.description || "");
      const refundedQty = refundedQtyByItem[key] || 0;
      const remainingQty = Math.max(0, round2(Number(it.quantity || 0) - refundedQty));
      return {
        id: it.id,
        itemId: it.itemId,
        description: it.description,
        originalQuantity: Number(it.quantity || 0),
        quantity: remainingQty,
        remainingQuantity: remainingQty,
        refundedQuantity: refundedQty,
        unitPrice: Number(it.unitPrice || 0),
        discount: Number(it.discount || 0),
        amount: round2(remainingQty * Number(it.unitPrice || 0)),
        batchNumber: it.batchNumber,
        expiryDate: it.expiryDate,
        warehouseName: it.warehouseName,
        itemBatchId: it.itemBatchId,
      };
    });

    const hasRemainingItems = refundableItems.some((it) => it.remainingQuantity > 0.0001);

    if (remainingRefundableAmount <= 0.01 && !hasRemainingItems) {
      continue;
    }

    results.push({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      date: inv.createdAt,
      customerId: inv.party?.id || null,
      customerName: inv.party?.name || "Walk-in Customer",
      customerPhone: inv.party?.phone || null,
      itemsCount: inv.items?.length || 0,
      remainingItemsCount: refundableItems.filter((it) => it.remainingQuantity > 0).length,
      grandTotal,
      paidAmount: Number(inv.paidAmount || 0),
      status: inv.status,
      isCredit: Boolean(inv.balanceAmount && Number(inv.balanceAmount) > 0.001),
      totalRefunded,
      remainingRefundableAmount,
      refundableItems,
      previousRefundsCount: inv.posRefunds?.length || 0,
      payments: (inv.payments || []).map((p: any) => ({
        id: p.id,
        method: p.method,
        amount: Number(p.amount || 0),
      })),
    });
  }
  return results;
}

export async function getInvoiceReceiptDuplicate(invoiceId: string) {
  await requirePOSProfileAccess();
  const organizationId = await requireOrganizationId();
  const raw = await prisma.invoice.findFirst({
    where: withOrganization(organizationId, { id: invoiceId }),
    include: {
      party: { select: { name: true } },
      items: {
        select: {
          id: true,
          itemId: true,
          description: true,
          quantity: true,
          unitPrice: true,
          amount: true,
          discount: true,
          batchNumber: true,
          expiryDate: true,
          warehouseName: true,
          itemBatchId: true,
        },
      },
      payments: {
        select: {
          method: true,
          amount: true,
          reference: true,
        },
      },
      posRefunds: {
        where: { status: "ISSUED" },
        select: {
          grandTotal: true,
          linesJson: true,
        },
      },
      posProfile: {
        select: {
          receiptHeader: true,
          receiptFooter: true,
          posCounter: { select: { name: true } },
        },
      },
      posCounter: {
        select: { name: true },
      },
      cashierShift: {
        select: {
          counterName: true,
          posCounter: { select: { name: true } },
        },
      },
    },
  });
  if (!raw) return { error: "Invoice not found" };
  const invoice: any = raw;

  const refundedQtyByItem: Record<string, number> = {};
  for (const r of invoice.posRefunds || []) {
    const rLines = Array.isArray(r.linesJson) ? (r.linesJson as any[]) : [];
    for (const rl of rLines) {
      if (!rl || typeof rl !== "object") continue;
      const key = String((rl as any).itemId || (rl as any).description || "");
      refundedQtyByItem[key] = (refundedQtyByItem[key] || 0) + Number((rl as any).quantity || 0);
    }
  }

  const lines: any[] = (invoice.items || []).map((i: any) => {
    const key = String(i.itemId || i.description || "");
    const refundedQty = refundedQtyByItem[key] || 0;
    const remainingQty = Math.max(0, round2(Number(i.quantity || 0) - refundedQty));
    return {
      itemId: i.itemId || null,
      description: i.description || "",
      originalQuantity: Number(i.quantity || 0),
      quantity: remainingQty,
      remainingQuantity: remainingQty,
      refundedQuantity: refundedQty,
      unitPrice: Number(i.unitPrice || 0),
      amount: round2(remainingQty * Number(i.unitPrice || 0)),
      discount: i.discount ? Number(i.discount) : undefined,
      batchNumber: i.batchNumber || null,
      expiryDate: i.expiryDate || null,
      warehouseName: i.warehouseName || null,
      itemBatchId: i.itemBatchId || null,
    };
  });

  const payments: any[] = (invoice.payments || []).map((p: any) => ({
    method: p.method || "Cash",
    amount: Number(p.amount || 0),
    reference: p.reference || undefined,
  }));
  const isCredit = Boolean(
    invoice.balanceAmount && Number(invoice.balanceAmount) > 0.001,
  );
  const totalRefunded = (invoice.posRefunds || []).reduce((s: number, r: any) => s + round2(r.grandTotal || 0), 0);
  const remainingRefundableAmount = round2(Math.max(0, Number(invoice.grandTotal || 0) - totalRefunded));
  const subtotal =
    Number(invoice.subTotal) ??
    lines.reduce((s: number, l: any) => s + Number(l.amount), 0);
  const receipt: any = {
    invoiceNumber: invoice.invoiceNumber,
    receiptHeader: invoice.posProfile?.receiptHeader ?? undefined,
    receiptFooter: invoice.posProfile?.receiptFooter ?? undefined,
    counterName:
      invoice.cashierShift?.counterName ||
      invoice.cashierShift?.posCounter?.name ||
      invoice.posCounter?.name ||
      invoice.posProfile?.posCounter?.name ||
      undefined,
    customerName: invoice.party?.name || "Walk-in Customer",
    date: invoice.createdAt,
    lines,
    subTotal: Number(subtotal),
    discountTotal: Number(invoice.discountTotal || 0),
    grandTotal: Number(invoice.grandTotal || 0),
    totalRefunded,
    remainingRefundableAmount,
    payments: isCredit ? [] : payments,
    change: undefined,
    isCredit,
  };
  return { ok: true, receipt };
}

export async function fetchItemBatchesForPOS(itemId: string, warehouseName?: string | null) {
  await requirePOSProfileAccess();
  const organizationId = requireOrganizationId();
  return prisma.itemBatch.findMany({
    where: withOrganization(organizationId as any, {
      itemId,
      isActive: true,
      availableQty: { gt: 0 },
      ...(warehouseName ? { warehouseName } : {}),
    } as any),
    orderBy: [
      { expiryDate: { sort: "asc", nulls: "last" } },
      { receivedDate: "asc" },
    ],
    take: 50,
  });
}

export async function posRefund(payload: {
  branch: "INVOICE_REVERSAL" | "STANDALONE_JE";
  invoiceId?: string;
  partyId?: string;
  refundMethod: "CASH" | "CARD" | "BANK" | "WALLET";
  refundAccountId?: string;
  reason?: string | null;
  note?: string | null;
  lines: Array<{
    itemId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    amount: number;
    batchNumber?: string | null;
    expiryDate?: string | null;
    warehouseName?: string | null;
    itemBatchId?: string | null;
  }>;
  cartDiscount?: number;
  sourcePaymentId?: string;
}): Promise<ActionResult<any>> {
  return withActionError("posRefund", async () => {
  await requirePermission("pos.refund.do");
  const organizationId = await requireOrganizationId();
  const ctx = await getPermissionContext();
  const userId = ctx.userId;
  if (!userId) throw new Error("Not authenticated");
  if (!payload.lines || payload.lines.length === 0) return { ok: false, error: "No refund lines provided" };
  if (!["INVOICE_REVERSAL", "STANDALONE_JE"].includes(payload.branch)) {
    return { ok: false, error: "Invalid branch" };
  }
  const method = String(payload.refundMethod || "CASH").toUpperCase() as "CASH" | "CARD" | "BANK" | "WALLET";
  if (!["CASH", "CARD", "BANK", "WALLET"].includes(method)) {
    return { ok: false, error: "Invalid refund method" };
  }

  const result = await prisma.$transaction(async (tx: any) => {
    const shift = await requireShiftOpenAndOwned(tx, userId, organizationId, {
      actionHint: "issuing a refund",
    });
    const settings = await getCompanySettings(tx, organizationId);
    if (!settings) throw new Error("Company settings missing");
    const currency = (settings as any).baseCurrency || "PKR";
    const profile = await tx.pOSProfile.findFirst({
      where: withOrganization(organizationId, { id: shift.posProfileId, isActive: true }),
      include: {
        posCounter: true,
        walkinCustomer: true,
        defaultCashAccount: true,
        defaultBankAccount: true,
      },
    });
    if (!profile) throw new Error("POS profile missing for this shift");
    const subTotal = payload.lines.reduce((s: number, l) => s + round2(Number(l.quantity) * Number(l.unitPrice)), 0);
    const lineDisc = payload.lines.reduce((s: number, l) => s + round2(Number(l.discount) || 0), 0);
    const cartDisc = round2(Number(payload.cartDiscount) || 0);
    const totalDiscount = round2(lineDisc + cartDisc);
    const grandTotal = round2(Math.max(0, subTotal - totalDiscount));

    let partyId: string | null = payload.partyId || null;
    if (payload.branch === "INVOICE_REVERSAL" && payload.invoiceId) {
      const inv = await tx.invoice.findFirst({
        where: withOrganization(organizationId, { id: payload.invoiceId }),
        include: {
          party: { select: { id: true, name: true, type: true } },
          payments: true,
          items: true,
          posRefunds: { where: { status: "ISSUED" } },
        },
      });
      if (!inv) throw new Error("Invoice not found");
      partyId = inv.partyId;
      if (inv.status === "CANCELLED") throw new Error("Invoice already fully refunded / cancelled");

      const totalPrevRefunded = (inv.posRefunds || []).reduce((s: number, r: any) => s + round2(r.grandTotal || 0), 0);
      const remainingRefundable = round2(Number(inv.grandTotal || 0) - totalPrevRefunded);
      if (grandTotal > remainingRefundable + 0.01) {
        throw new Error(`Refund amount (${grandTotal}) exceeds remaining refundable balance (${remainingRefundable}) of invoice`);
      }

      const prevRefundedQty: Record<string, number> = {};
      for (const pr of inv.posRefunds || []) {
        const prLines = Array.isArray(pr.linesJson) ? (pr.linesJson as any[]) : [];
        for (const l of prLines) {
          if (!l || typeof l !== "object") continue;
          const k = String((l as any).itemId || (l as any).description || "");
          prevRefundedQty[k] = (prevRefundedQty[k] || 0) + Number((l as any).quantity || 0);
        }
      }
      for (const line of payload.lines) {
        const k = String(line.itemId || line.description || "");
        const invItem = inv.items.find((it: any) => String(it.itemId || it.description || "") === k);
        const origQty = invItem ? Number(invItem.quantity || 0) : Number(line.quantity || 0);
        const alreadyRefunded = prevRefundedQty[k] || 0;
        const availQty = Math.max(0, origQty - alreadyRefunded);
        if (Number(line.quantity) > availQty + 0.0001) {
          throw new Error(`Cannot refund ${line.quantity} of "${line.description}". Only ${availQty} remaining to refund.`);
        }
      }

      if (payload.sourcePaymentId && inv.payments.length > 0) {
        const found = inv.payments.find((p: any) => p.id === payload.sourcePaymentId);
        if (!found) throw new Error("Source payment not found on invoice");
      }
    } else if (payload.branch === "STANDALONE_JE" && !partyId) {
      partyId = profile.walkinCustomerId;
    }
    if (!partyId) throw new Error("Party (customer) is required for refund");
    const party = await tx.party.findFirst({ where: withOrganization(organizationId, { id: partyId }) });
    if (!party) throw new Error("Customer not found");

    const refundPrefix = (settings as any).refundPrefix || "RF-";
    const settingsForRefundSeq = (await tx.companySettings.findFirst({ where: { id: (settings as any).id } })) as any;
    const refundCurrNum = settingsForRefundSeq?.refundCurrentNumber || 1;
    const refundNumber = `${refundPrefix}${String(refundCurrNum).padStart(5, "0")}`;
    await tx.companySettings.update({
      where: { id: (settings as any).id },
      data: { refundCurrentNumber: { increment: 1 } },
    });

    let refundAccountId: string | null = payload.refundAccountId || null;
    if (!refundAccountId) {
      if (method === "CASH" || method === "WALLET") {
        refundAccountId = profile.defaultCashAccountId;
      } else if (method === "BANK" || method === "CARD") {
        refundAccountId = profile.defaultBankAccountId;
      }
    }
    if (!refundAccountId) {
      const hint =
        method === "CASH" || method === "WALLET"
          ? "default cash account"
          : "default bank account";
      throw new Error(`Refund method ${method} needs a configured ${hint} on POS profile`);
    }

    let reversalPayment: any = null;
    if (payload.branch === "INVOICE_REVERSAL" && payload.invoiceId && method !== "WALLET" && grandTotal > 0) {
      const payPrefix = (settings as any).paymentPrefix || "PAY-";
      const payCurrNum = ((await tx.companySettings.findFirst({ where: { id: (settings as any).id } })) as any)?.paymentCurrentNumber || 1;
      const paymentNumber = `${payPrefix}${String(payCurrNum).padStart(5, "0")}`;
      reversalPayment = await tx.payment.create({
        data: {
          organizationId,
          paymentNumber,
          date: new Date(),
          type: "REFUND_OUT",
          method,
          reference: payload.reason || null,
          partyId,
          amount: -grandTotal,
          currency,
          exchangeRate: 1,
          invoiceId: payload.invoiceId || null,
          notes: payload.note || null,
        },
      });
      await tx.companySettings.update({
        where: { id: (settings as any).id },
        data: { paymentCurrentNumber: { increment: 1 } },
      });
    }

    let invoiceRef: any = null;
    if (payload.branch === "INVOICE_REVERSAL" && payload.invoiceId) {
      const inv = await tx.invoice.findFirst({
        where: withOrganization(organizationId, { id: payload.invoiceId }),
        include: {
          items: true,
          posRefunds: { where: { status: "ISSUED" } },
        },
      });
      if (inv) {
        invoiceRef = { id: inv.id, invoiceNumber: inv.invoiceNumber };
        const totalPrevRefunded = (inv.posRefunds || []).reduce((s: number, r: any) => s + round2(r.grandTotal || 0), 0);
        const newTotalRefunded = round2(totalPrevRefunded + grandTotal);
        const isFullyRefunded = newTotalRefunded >= round2(inv.grandTotal) - 0.01;

        if (isFullyRefunded) {
          await tx.invoice.update({
            where: { id: inv.id },
            data: {
              status: "CANCELLED",
              balanceAmount: 0,
            },
          });
        }

        // Restore inventory ONLY for the items and quantities actually being refunded in this return:
        const affectedItemIds: string[] = [];
        for (const line of payload.lines) {
          const qty = Number(line.quantity || 0);
          if (line.itemId && qty > 0) {
            await tx.stockMovement.create({
              data: {
                organizationId,
                itemId: line.itemId,
                invoiceId: inv.id,
                transactionDate: new Date(),
                direction: "IN",
                movementType: "RETURN",
                sourceType: "POS_REFUND",
                sourceNumber: refundNumber,
                note: `POS Return from ${inv.invoiceNumber}: ${line.description}`,
                quantity: qty,
                unitCost: Number(line.unitPrice || 0),
                totalCost: round2(qty * Number(line.unitPrice || 0)),
                batchNumber: line.batchNumber || null,
                expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
                warehouseName: line.warehouseName || profile.posCounter?.linkedWarehouseName || null,
              },
            });
            affectedItemIds.push(line.itemId);
          }
        }
        if (affectedItemIds.length > 0) {
          await rebuildInventoryForItems(tx, organizationId, affectedItemIds);
        }
      }
    }

    const descriptionJE = payload.branch === "INVOICE_REVERSAL"
      ? `POS refund (inv reversal) #${refundNumber}${invoiceRef?.invoiceNumber ? " - " + invoiceRef.invoiceNumber : ""}`
      : `POS refund (standalone JE) #${refundNumber}`;

    const rows: JournalRowInput[] = [];
    const receivable = (settings as any).defaultReceivableAccount;
    let arAccountId: string | null = null;
    if (receivable) {
      const a = await tx.account.findFirst({
        where: withOrganization(organizationId, { OR: [{ id: receivable }, { name: receivable }] }),
      });
      if (a) arAccountId = a.id;
    }
    if (!arAccountId) {
      const a = await tx.account.findFirst({ where: withOrganization(organizationId, { name: "Accounts Receivable" }) });
      if (a) arAccountId = a.id;
    }
    rows.push({
      accountId: refundAccountId,
      debit: 0,
      credit: grandTotal,
      description: `Refund paid via ${method}`,
    });

    const salesAccount = (settings as any).defaultSalesAccount;
    let salesAccountId: string | null = null;
    if (salesAccount) {
      const a = await tx.account.findFirst({
        where: withOrganization(organizationId, { OR: [{ id: salesAccount }, { name: salesAccount }] }),
      });
      if (a) salesAccountId = a.id;
    }
    if (!salesAccountId) {
      const a = await tx.account.findFirst({ where: withOrganization(organizationId, { name: "Sales" }) });
      if (a) salesAccountId = a.id;
    }

    const debitAccountId = salesAccountId || arAccountId;
    if (!debitAccountId) {
      throw new Error("No sales or Accounts Receivable account configured for refund journal");
    }
    rows.push({
      accountId: debitAccountId,
      debit: grandTotal,
      credit: 0,
      description: payload.branch === "INVOICE_REVERSAL"
        ? `Reverse sales for refund #${refundNumber}${invoiceRef?.invoiceNumber ? " (" + invoiceRef.invoiceNumber + ")" : ""}`
        : "Reverse revenue for standalone refund",
    });

    const linkData: Record<string, unknown> = {};
    if (reversalPayment) {
      linkData.payment = { connect: { id: reversalPayment.id } };
    }
    if (payload.branch === "INVOICE_REVERSAL" && payload.invoiceId) {
      linkData.refundedInvoiceId = payload.invoiceId;
    }
    const journalEntry = await createSequencedJournalEntry(tx, organizationId, {
      date: new Date(),
      description: descriptionJE,
      reference: refundNumber,
      currency,
      exchangeRate: 1,
      rows,
      linkData,
    });
    if (reversalPayment) {
      await tx.payment.update({
        where: { id: reversalPayment.id },
        data: { journalEntryId: journalEntry.id },
      });
    }

    const refund = await tx.pOSRefund.create({
      data: {
        organizationId,
        refundNumber,
        branch: payload.branch,
        date: new Date(),
        invoiceId: payload.invoiceId || null,
        partyId,
        cashierShiftId: shift.id,
        posProfileId: shift.posProfileId,
        userId,
        subTotal,
        discountTotal: totalDiscount,
        grandTotal,
        refundMethod: method,
        refundAccountId,
        reason: payload.reason || null,
        linesJson: payload.lines as any,
        journalEntryId: journalEntry.id,
        invoicePaymentId: payload.sourcePaymentId || null,
        reversalPaymentId: reversalPayment?.id || null,
        status: "ISSUED",
        notes: payload.note || null,
      },
    });

    const cashAdd = method === "CASH" ? -grandTotal : 0;
    const cardAdd = method === "CARD" ? -grandTotal : 0;
    const bankAdd = method === "BANK" ? -grandTotal : 0;
    const walletAdd = method === "WALLET" ? -grandTotal : 0;
    await tx.cashierShift.update({
      where: { id: shift.id },
      data: {
        cashExpected: { increment: cashAdd },
        cardExpected: { increment: cardAdd },
        bankExpected: { increment: bankAdd },
        walletExpected: { increment: walletAdd },
        refundTotal: { increment: grandTotal },
      },
    });
    return { ok: true, refundId: refund.id, refundNumber, grandTotal };
  });

  revalidatePath("/pos");
  revalidatePath("/pos/refunds");
  return result;
  });
}

type ReportKind = "X" | "Z";

export async function generatePOSReport(kind: ReportKind, closing?: {
  closingCash?: number | null;
  closingCard?: number | null;
  closingBank?: number | null;
  closingWallet?: number | null;
  closeNotes?: string | null;
}): Promise<ActionResult<any>> {
  return withActionError("generatePOSReport", async () => {
    const permissionKey = kind === "X" ? "pos.report.xReport" : "pos.report.zReport";
    await requirePermission(permissionKey);
    const organizationId = await requireOrganizationId();
    const ctx = await getPermissionContext();
    const userId = ctx.userId;
    if (!userId) throw new Error("Not authenticated");

    const result = await prisma.$transaction(async (tx: any) => {
      const shift = await requireShiftOpenAndOwned(tx, userId, organizationId, {
        actionHint: kind === "X" ? "generating X Reports" : "closing the shift with Z Report",
      });
      return generateShiftSnapshotsInternal(tx, {
        shift,
        organizationId,
        userId,
        userName: (ctx as any).userName || null,
        kind,
        closing,
      });
    });

    revalidatePath("/pos");
    revalidatePath("/register");
    revalidatePath("/pos/reports/x");
    revalidatePath("/pos/reports/z");
    revalidatePath("/pos/shifts");

    return result;
  });
}

export async function getPOSReportSnapshots(kind: "X" | "Z", take = 30) {
  await requirePOSProfileAccess();
  const organizationId = await requireOrganizationId();
  return prisma.pOSReportSnapshot.findMany({
    where: withOrganization(organizationId, { kind }),
    orderBy: { generatedAt: "desc" },
    take,
  });
}

