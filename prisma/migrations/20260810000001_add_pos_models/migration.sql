-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN     "defaultCurrencyNotes" JSONB NOT NULL DEFAULT '[5000,1000,500,100,50,20,10,5,1]',
ADD COLUMN     "posCurrentNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "posInvoicePrefix" TEXT NOT NULL DEFAULT 'POS-',
ADD COLUMN     "quickAmountRounding" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "silentPrintEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "cashierShiftId" TEXT,
ADD COLUMN     "holdKey" TEXT,
ADD COLUMN     "isPos" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "posCounterId" TEXT,
ADD COLUMN     "posCounterSnapshot" TEXT,
ADD COLUMN     "posProfileId" TEXT,
ADD COLUMN     "receiptPrintedCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ItemUnitConversion" ADD COLUMN     "barcode" TEXT;

-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "refundedInvoiceId" TEXT;

-- AlterTable
ALTER TABLE "Organization" ALTER COLUMN "enabledModules" SET DEFAULT '["customers","invoices","payments","inventory","journal","reports","hr","pos"]';

-- CreateTable
CREATE TABLE "CounterMaster" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "linkedWarehouseName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CounterMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "POSProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "defaultUserId" TEXT,
    "walkinCustomerId" TEXT NOT NULL,
    "defaultPriceListId" TEXT,
    "defaultPaymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "posCounterId" TEXT NOT NULL,
    "defaultCashAccountId" TEXT NOT NULL,
    "defaultBankAccountId" TEXT NOT NULL,
    "allowCreditCheckout" BOOLEAN NOT NULL DEFAULT false,
    "allowPriceOverride" BOOLEAN NOT NULL DEFAULT false,
    "allowDiscount" BOOLEAN NOT NULL DEFAULT true,
    "maxDiscountPct" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "requireCustomerForCredit" BOOLEAN NOT NULL DEFAULT true,
    "customerQuickCreate" BOOLEAN NOT NULL DEFAULT true,
    "hideOutOfStockItems" BOOLEAN NOT NULL DEFAULT true,
    "receiptHeader" TEXT,
    "receiptFooter" TEXT,
    "printerName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "POSProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashierShift" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "posProfileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shiftNumber" TEXT NOT NULL,
    "warehouseName" TEXT,
    "counterName" TEXT,
    "posCounterId" TEXT NOT NULL,
    "posCounterSnapshot" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openingFloat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashExpected" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cardExpected" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bankExpected" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "walletExpected" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "creditExpected" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "refundTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billsCount" INTEGER NOT NULL DEFAULT 0,
    "itemsCount" INTEGER NOT NULL DEFAULT 0,
    "closingCashCounted" DOUBLE PRECISION,
    "closingCardCounted" DOUBLE PRECISION,
    "closingBankCounted" DOUBLE PRECISION,
    "closingWalletCounted" DOUBLE PRECISION,
    "cashVariance" DOUBLE PRECISION,
    "cardVariance" DOUBLE PRECISION,
    "bankVariance" DOUBLE PRECISION,
    "walletVariance" DOUBLE PRECISION,
    "closeNotes" TEXT,
    "reconciledByUserId" TEXT,
    "reconciledAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashierShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosSavedOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "posProfileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "customerId" TEXT,
    "itemsJson" JSONB NOT NULL,
    "totalsJson" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosSavedOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CounterMaster_organizationId_idx" ON "CounterMaster"("organizationId");

-- CreateIndex
CREATE INDEX "CounterMaster_code_idx" ON "CounterMaster"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CounterMaster_organizationId_name_key" ON "CounterMaster"("organizationId", "name");

-- CreateIndex
CREATE INDEX "POSProfile_organizationId_idx" ON "POSProfile"("organizationId");

-- CreateIndex
CREATE INDEX "POSProfile_posCounterId_idx" ON "POSProfile"("posCounterId");

-- CreateIndex
CREATE INDEX "POSProfile_isActive_idx" ON "POSProfile"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "POSProfile_organizationId_name_key" ON "POSProfile"("organizationId", "name");

-- CreateIndex
CREATE INDEX "CashierShift_organizationId_idx" ON "CashierShift"("organizationId");

-- CreateIndex
CREATE INDEX "CashierShift_status_idx" ON "CashierShift"("status");

-- CreateIndex
CREATE INDEX "CashierShift_posProfileId_idx" ON "CashierShift"("posProfileId");

-- CreateIndex
CREATE INDEX "CashierShift_posCounterId_idx" ON "CashierShift"("posCounterId");

-- CreateIndex
CREATE INDEX "CashierShift_userId_idx" ON "CashierShift"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CashierShift_organizationId_shiftNumber_key" ON "CashierShift"("organizationId", "shiftNumber");

-- CreateIndex
CREATE INDEX "PosSavedOrder_organizationId_idx" ON "PosSavedOrder"("organizationId");

-- CreateIndex
CREATE INDEX "PosSavedOrder_status_idx" ON "PosSavedOrder"("status");

-- CreateIndex
CREATE INDEX "PosSavedOrder_posProfileId_idx" ON "PosSavedOrder"("posProfileId");

-- CreateIndex
CREATE INDEX "PosSavedOrder_userId_idx" ON "PosSavedOrder"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PosSavedOrder_organizationId_orderKey_key" ON "PosSavedOrder"("organizationId", "orderKey");

-- CreateIndex
CREATE INDEX "Invoice_posProfileId_idx" ON "Invoice"("posProfileId");

-- CreateIndex
CREATE INDEX "Invoice_posCounterId_idx" ON "Invoice"("posCounterId");

-- CreateIndex
CREATE INDEX "Invoice_cashierShiftId_idx" ON "Invoice"("cashierShiftId");

-- CreateIndex
CREATE INDEX "Invoice_isPos_idx" ON "Invoice"("isPos");

-- CreateIndex
CREATE INDEX "ItemUnitConversion_barcode_idx" ON "ItemUnitConversion"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "ItemUnitConversion_organizationId_barcode_key" ON "ItemUnitConversion"("organizationId", "barcode");

-- CreateIndex
CREATE INDEX "JournalEntry_refundedInvoiceId_idx" ON "JournalEntry"("refundedInvoiceId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_posProfileId_fkey" FOREIGN KEY ("posProfileId") REFERENCES "POSProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_posCounterId_fkey" FOREIGN KEY ("posCounterId") REFERENCES "CounterMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_cashierShiftId_fkey" FOREIGN KEY ("cashierShiftId") REFERENCES "CashierShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_refundedInvoiceId_fkey" FOREIGN KEY ("refundedInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CounterMaster" ADD CONSTRAINT "CounterMaster_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POSProfile" ADD CONSTRAINT "POSProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POSProfile" ADD CONSTRAINT "POSProfile_defaultUserId_fkey" FOREIGN KEY ("defaultUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POSProfile" ADD CONSTRAINT "POSProfile_walkinCustomerId_fkey" FOREIGN KEY ("walkinCustomerId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POSProfile" ADD CONSTRAINT "POSProfile_defaultPriceListId_fkey" FOREIGN KEY ("defaultPriceListId") REFERENCES "PriceList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POSProfile" ADD CONSTRAINT "POSProfile_posCounterId_fkey" FOREIGN KEY ("posCounterId") REFERENCES "CounterMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POSProfile" ADD CONSTRAINT "POSProfile_defaultCashAccountId_fkey" FOREIGN KEY ("defaultCashAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POSProfile" ADD CONSTRAINT "POSProfile_defaultBankAccountId_fkey" FOREIGN KEY ("defaultBankAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierShift" ADD CONSTRAINT "CashierShift_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierShift" ADD CONSTRAINT "CashierShift_posProfileId_fkey" FOREIGN KEY ("posProfileId") REFERENCES "POSProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierShift" ADD CONSTRAINT "CashierShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierShift" ADD CONSTRAINT "CashierShift_posCounterId_fkey" FOREIGN KEY ("posCounterId") REFERENCES "CounterMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierShift" ADD CONSTRAINT "CashierShift_reconciledByUserId_fkey" FOREIGN KEY ("reconciledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSavedOrder" ADD CONSTRAINT "PosSavedOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSavedOrder" ADD CONSTRAINT "PosSavedOrder_posProfileId_fkey" FOREIGN KEY ("posProfileId") REFERENCES "POSProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSavedOrder" ADD CONSTRAINT "PosSavedOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSavedOrder" ADD CONSTRAINT "PosSavedOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

