-- PHASE 2: POS refund, X/Z reports, and ItemBatch FK on InvoiceLine

CREATE TABLE IF NOT EXISTS "POSRefund" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "refundNumber" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branch" TEXT NOT NULL,
    "invoiceId" TEXT,
    "partyId" TEXT NOT NULL,
    "cashierShiftId" TEXT,
    "posProfileId" TEXT,
    "userId" TEXT NOT NULL,
    "subTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "refundMethod" TEXT NOT NULL,
    "refundAccountId" TEXT,
    "reason" TEXT,
    "linesJson" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "journalEntryId" TEXT,
    "invoicePaymentId" TEXT,
    "reversalPaymentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "POSRefund_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "POSReportSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "snapshotNumber" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cashierShiftId" TEXT,
    "posProfileId" TEXT,
    "posCounterId" TEXT,
    "userId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "openingFloat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billsCount" INTEGER NOT NULL DEFAULT 0,
    "itemsCount" INTEGER NOT NULL DEFAULT 0,
    "refundCount" INTEGER NOT NULL DEFAULT 0,
    "grossSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "refundTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cardSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bankSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "walletSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "creditSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "splitTenderCount" INTEGER NOT NULL DEFAULT 0,
    "cashExpected" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cardExpected" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bankExpected" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "walletExpected" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "closingCashCounted" DOUBLE PRECISION,
    "closingCardCounted" DOUBLE PRECISION,
    "closingBankCounted" DOUBLE PRECISION,
    "closingWalletCounted" DOUBLE PRECISION,
    "cashVariance" DOUBLE PRECISION,
    "cardVariance" DOUBLE PRECISION,
    "bankVariance" DOUBLE PRECISION,
    "walletVariance" DOUBLE PRECISION,
    "summaryJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "lineItemsJson" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "tenderBreakdownJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "categoryBreakdownJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "taxBreakdownJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "closeNotes" TEXT,
    "reconciledByUserId" TEXT,
    "reconciledAt" TIMESTAMP(3),
    "printCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "POSReportSnapshot_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "itemBatchId" TEXT;
CREATE INDEX IF NOT EXISTS "InvoiceItem_itemBatchId_idx" ON "InvoiceItem"("itemBatchId");

-- POSRefund constraints + indexes
CREATE UNIQUE INDEX IF NOT EXISTS "POSRefund_organizationId_refundNumber_key" ON "POSRefund"("organizationId", "refundNumber");
CREATE INDEX IF NOT EXISTS "POSRefund_organizationId_idx" ON "POSRefund"("organizationId");
CREATE INDEX IF NOT EXISTS "POSRefund_date_idx" ON "POSRefund"("date");
CREATE INDEX IF NOT EXISTS "POSRefund_invoiceId_idx" ON "POSRefund"("invoiceId");
CREATE INDEX IF NOT EXISTS "POSRefund_partyId_idx" ON "POSRefund"("partyId");
CREATE INDEX IF NOT EXISTS "POSRefund_cashierShiftId_idx" ON "POSRefund"("cashierShiftId");
CREATE INDEX IF NOT EXISTS "POSRefund_posProfileId_idx" ON "POSRefund"("posProfileId");
CREATE INDEX IF NOT EXISTS "POSRefund_userId_idx" ON "POSRefund"("userId");
CREATE INDEX IF NOT EXISTS "POSRefund_status_idx" ON "POSRefund"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "POSRefund_journalEntryId_key" ON "POSRefund"("journalEntryId");

ALTER TABLE "POSRefund" DROP CONSTRAINT IF EXISTS "POSRefund_organizationId_fkey";
ALTER TABLE "POSRefund" DROP CONSTRAINT IF EXISTS "POSRefund_invoiceId_fkey";
ALTER TABLE "POSRefund" DROP CONSTRAINT IF EXISTS "POSRefund_partyId_fkey";
ALTER TABLE "POSRefund" DROP CONSTRAINT IF EXISTS "POSRefund_cashierShiftId_fkey";
ALTER TABLE "POSRefund" DROP CONSTRAINT IF EXISTS "POSRefund_posProfileId_fkey";
ALTER TABLE "POSRefund" DROP CONSTRAINT IF EXISTS "POSRefund_userId_fkey";
ALTER TABLE "POSRefund" DROP CONSTRAINT IF EXISTS "POSRefund_refundAccountId_fkey";
ALTER TABLE "POSRefund" DROP CONSTRAINT IF EXISTS "POSRefund_journalEntryId_fkey";
ALTER TABLE "POSRefund" DROP CONSTRAINT IF EXISTS "POSRefund_reversalPaymentId_fkey";

ALTER TABLE "POSRefund" ADD CONSTRAINT "POSRefund_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "POSRefund" ADD CONSTRAINT "POSRefund_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "POSRefund" ADD CONSTRAINT "POSRefund_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "POSRefund" ADD CONSTRAINT "POSRefund_cashierShiftId_fkey" FOREIGN KEY ("cashierShiftId") REFERENCES "CashierShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "POSRefund" ADD CONSTRAINT "POSRefund_posProfileId_fkey" FOREIGN KEY ("posProfileId") REFERENCES "POSProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "POSRefund" ADD CONSTRAINT "POSRefund_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "POSRefund" ADD CONSTRAINT "POSRefund_refundAccountId_fkey" FOREIGN KEY ("refundAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "POSRefund" ADD CONSTRAINT "POSRefund_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "POSRefund" ADD CONSTRAINT "POSRefund_reversalPaymentId_fkey" FOREIGN KEY ("reversalPaymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- POSReportSnapshot constraints + indexes
CREATE UNIQUE INDEX IF NOT EXISTS "POSReportSnapshot_organizationId_kind_snapshotNumber_key" ON "POSReportSnapshot"("organizationId", "kind", "snapshotNumber");
CREATE INDEX IF NOT EXISTS "POSReportSnapshot_organizationId_idx" ON "POSReportSnapshot"("organizationId");
CREATE INDEX IF NOT EXISTS "POSReportSnapshot_kind_idx" ON "POSReportSnapshot"("kind");
CREATE INDEX IF NOT EXISTS "POSReportSnapshot_generatedAt_idx" ON "POSReportSnapshot"("generatedAt");
CREATE INDEX IF NOT EXISTS "POSReportSnapshot_cashierShiftId_idx" ON "POSReportSnapshot"("cashierShiftId");
CREATE INDEX IF NOT EXISTS "POSReportSnapshot_posProfileId_idx" ON "POSReportSnapshot"("posProfileId");
CREATE INDEX IF NOT EXISTS "POSReportSnapshot_posCounterId_idx" ON "POSReportSnapshot"("posCounterId");
CREATE INDEX IF NOT EXISTS "POSReportSnapshot_userId_idx" ON "POSReportSnapshot"("userId");

ALTER TABLE "POSReportSnapshot" DROP CONSTRAINT IF EXISTS "POSReportSnapshot_organizationId_fkey";
ALTER TABLE "POSReportSnapshot" DROP CONSTRAINT IF EXISTS "POSReportSnapshot_cashierShiftId_fkey";
ALTER TABLE "POSReportSnapshot" DROP CONSTRAINT IF EXISTS "POSReportSnapshot_posProfileId_fkey";
ALTER TABLE "POSReportSnapshot" DROP CONSTRAINT IF EXISTS "POSReportSnapshot_posCounterId_fkey";
ALTER TABLE "POSReportSnapshot" DROP CONSTRAINT IF EXISTS "POSReportSnapshot_userId_fkey";
ALTER TABLE "POSReportSnapshot" DROP CONSTRAINT IF EXISTS "POSReportSnapshot_reconciledByUserId_fkey";

ALTER TABLE "POSReportSnapshot" ADD CONSTRAINT "POSReportSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "POSReportSnapshot" ADD CONSTRAINT "POSReportSnapshot_cashierShiftId_fkey" FOREIGN KEY ("cashierShiftId") REFERENCES "CashierShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "POSReportSnapshot" ADD CONSTRAINT "POSReportSnapshot_posProfileId_fkey" FOREIGN KEY ("posProfileId") REFERENCES "POSProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "POSReportSnapshot" ADD CONSTRAINT "POSReportSnapshot_posCounterId_fkey" FOREIGN KEY ("posCounterId") REFERENCES "CounterMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "POSReportSnapshot" ADD CONSTRAINT "POSReportSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "POSReportSnapshot" ADD CONSTRAINT "POSReportSnapshot_reconciledByUserId_fkey" FOREIGN KEY ("reconciledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- InvoiceItem -> ItemBatch FK
ALTER TABLE "InvoiceItem" DROP CONSTRAINT IF EXISTS "InvoiceItem_itemBatchId_fkey";
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_itemBatchId_fkey" FOREIGN KEY ("itemBatchId") REFERENCES "ItemBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
