"use server";

import { hasPermission } from "@/lib/rbac";

import {
  fetchPosItems,
  getPosCategories,
  getHoldOrdersList,
  loadHoldOrder,
  saveHoldOrder,
  deleteHoldOrder,
  closeShift,
  posCheckout,
  listCustomersForPOS,
  createQuickCustomerPOS,
  getTodaysOrdersList,
  getInvoiceReceiptDuplicate,
  searchPOSInvoicesForRefund,
  fetchItemBatchesForPOS,
  posRefund,
  generatePOSReport,
  getPOSReportSnapshots,
} from "./actions";

export async function fetchPosItemsClient(params: {
  posProfileId: string;
  categoryId?: string | null;
  query?: string;
}) {
  return fetchPosItems(params);
}

export async function getPosCategoriesClient(profileId: string) {
  return getPosCategories(profileId);
}

export async function getHoldOrdersListClient(posProfileId: string) {
  return getHoldOrdersList(posProfileId);
}

export async function loadHoldOrderClient(id: string) {
  return loadHoldOrder(id);
}

export async function saveHoldOrderClient(input: {
  posProfileId: string;
  itemsJson: any;
  totalsJson: any;
  customerId?: string;
  notes?: string;
  existingId?: string;
}) {
  return saveHoldOrder(input);
}

export async function deleteHoldOrderClient(id: string) {
  return deleteHoldOrder(id);
}

export async function closeShiftClient(formData: FormData) {
  return closeShift(formData);
}

export async function posCheckoutClient(payload: {
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
}) {
  return posCheckout(payload);
}

export async function listCustomersClient(search?: string) {
  return listCustomersForPOS(search);
}

export async function createQuickCustomerClient(name: string) {
  return createQuickCustomerPOS(name);
}

export async function getTodaysOrdersClient(shiftId: string) {
  return getTodaysOrdersList(shiftId);
}

export async function getInvoiceReceiptDuplicateClient(invoiceId: string) {
  return getInvoiceReceiptDuplicate(invoiceId);
}

export async function searchPOSInvoicesForRefundClient(params: {
  query?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}) {
  return searchPOSInvoicesForRefund(params);
}

export async function fetchItemBatchesForPOSClient(itemId: string, warehouseName?: string | null) {
  return fetchItemBatchesForPOS(itemId, warehouseName);
}

export async function posRefundClient(payload: {
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
}) {
  return posRefund(payload);
}

export async function generatePOSReportClient(kind: "X" | "Z", closing?: {
  closingCash?: number | null;
  closingCard?: number | null;
  closingBank?: number | null;
  closingWallet?: number | null;
  closeNotes?: string | null;
}) {
  return generatePOSReport(kind, closing);
}

export async function getPOSReportSnapshotsClient(kind: "X" | "Z", take = 20) {
  return getPOSReportSnapshots(kind, take);
}

export async function hasPermissionClient(permissionKey: string) {
  try {
    await hasPermission(permissionKey);
    return true;
  } catch {
    return false;
  }
}
