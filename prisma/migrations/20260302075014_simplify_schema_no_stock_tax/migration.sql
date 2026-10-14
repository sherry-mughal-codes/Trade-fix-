/*
  Warnings:

  - You are about to drop the column `taxTotal` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `tax` on the `InvoiceItem` table. All the data in the column will be lost.
  - You are about to drop the column `stockQuantity` on the `Item` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN "defaultPayableAccount" TEXT;
ALTER TABLE "CompanySettings" ADD COLUMN "defaultPurchaseAccount" TEXT;
ALTER TABLE "CompanySettings" ADD COLUMN "defaultReceivableAccount" TEXT;
ALTER TABLE "CompanySettings" ADD COLUMN "defaultSalesAccount" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "date" DATETIME NOT NULL,
    "dueDate" DATETIME,
    "partyId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "exchangeRate" REAL NOT NULL DEFAULT 1.0,
    "subTotal" REAL NOT NULL DEFAULT 0,
    "discountTotal" REAL NOT NULL DEFAULT 0,
    "grandTotal" REAL NOT NULL DEFAULT 0,
    "baseGrandTotal" REAL NOT NULL DEFAULT 0,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "balanceAmount" REAL NOT NULL DEFAULT 0,
    "journalEntryId" TEXT,
    "notes" TEXT,
    "terms" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("balanceAmount", "baseGrandTotal", "createdAt", "currency", "date", "discountTotal", "dueDate", "exchangeRate", "grandTotal", "id", "invoiceNumber", "notes", "paidAmount", "partyId", "status", "subTotal", "terms", "type", "updatedAt") SELECT "balanceAmount", "baseGrandTotal", "createdAt", "currency", "date", "discountTotal", "dueDate", "exchangeRate", "grandTotal", "id", "invoiceNumber", "notes", "paidAmount", "partyId", "status", "subTotal", "terms", "type", "updatedAt" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE UNIQUE INDEX "Invoice_journalEntryId_key" ON "Invoice"("journalEntryId");
CREATE INDEX "Invoice_date_idx" ON "Invoice"("date");
CREATE INDEX "Invoice_partyId_idx" ON "Invoice"("partyId");
CREATE TABLE "new_InvoiceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "itemId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 1,
    "unitPrice" REAL NOT NULL DEFAULT 0,
    "discount" REAL NOT NULL DEFAULT 0,
    "amount" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_InvoiceItem" ("amount", "createdAt", "description", "discount", "id", "invoiceId", "itemId", "quantity", "unitPrice", "updatedAt") SELECT "amount", "createdAt", "description", "discount", "id", "invoiceId", "itemId", "quantity", "unitPrice", "updatedAt" FROM "InvoiceItem";
DROP TABLE "InvoiceItem";
ALTER TABLE "new_InvoiceItem" RENAME TO "InvoiceItem";
CREATE TABLE "new_Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'SERVICE',
    "salePrice" REAL NOT NULL DEFAULT 0,
    "purchasePrice" REAL NOT NULL DEFAULT 0,
    "incomeAccount" TEXT,
    "expenseAccount" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Item" ("createdAt", "description", "expenseAccount", "id", "incomeAccount", "name", "purchasePrice", "salePrice", "sku", "type", "updatedAt") SELECT "createdAt", "description", "expenseAccount", "id", "incomeAccount", "name", "purchasePrice", "salePrice", "sku", "type", "updatedAt" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE UNIQUE INDEX "Item_sku_key" ON "Item"("sku");
CREATE TABLE "new_Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentNumber" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "partyId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "invoiceId" TEXT,
    "journalEntryId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Payment" ("amount", "createdAt", "date", "id", "invoiceId", "method", "notes", "partyId", "paymentNumber", "reference", "type", "updatedAt") SELECT "amount", "createdAt", "date", "id", "invoiceId", "method", "notes", "partyId", "paymentNumber", "reference", "type", "updatedAt" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
CREATE UNIQUE INDEX "Payment_paymentNumber_key" ON "Payment"("paymentNumber");
CREATE UNIQUE INDEX "Payment_journalEntryId_key" ON "Payment"("journalEntryId");
CREATE INDEX "Payment_date_idx" ON "Payment"("date");
CREATE INDEX "Payment_partyId_idx" ON "Payment"("partyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
