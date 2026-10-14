/*
  Warnings:

  - You are about to drop the column `expenseAccount` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `incomeAccount` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `purchasePrice` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `salePrice` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `sku` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Item` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CompanySettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "taxId" TEXT,
    "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
    "dateFormat" TEXT NOT NULL DEFAULT 'YYYY-MM-DD',
    "invoiceTerms" TEXT,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV-',
    "invoiceStartNumber" INTEGER NOT NULL DEFAULT 1,
    "invoiceCurrentNumber" INTEGER NOT NULL DEFAULT 1,
    "journalPrefix" TEXT NOT NULL DEFAULT 'JRN-',
    "journalStartNumber" INTEGER NOT NULL DEFAULT 1,
    "journalCurrentNumber" INTEGER NOT NULL DEFAULT 1,
    "paymentPrefix" TEXT NOT NULL DEFAULT 'PAY-',
    "paymentStartNumber" INTEGER NOT NULL DEFAULT 1,
    "paymentCurrentNumber" INTEGER NOT NULL DEFAULT 1,
    "defaultSalesAccount" TEXT,
    "defaultPurchaseAccount" TEXT,
    "defaultReceivableAccount" TEXT,
    "defaultPayableAccount" TEXT,
    "logoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_CompanySettings" ("address", "baseCurrency", "companyName", "createdAt", "dateFormat", "defaultPayableAccount", "defaultPurchaseAccount", "defaultReceivableAccount", "defaultSalesAccount", "email", "id", "invoiceCurrentNumber", "invoicePrefix", "invoiceStartNumber", "invoiceTerms", "journalCurrentNumber", "journalPrefix", "journalStartNumber", "logoUrl", "phone", "taxId", "updatedAt") SELECT "address", "baseCurrency", "companyName", "createdAt", "dateFormat", "defaultPayableAccount", "defaultPurchaseAccount", "defaultReceivableAccount", "defaultSalesAccount", "email", "id", "invoiceCurrentNumber", "invoicePrefix", "invoiceStartNumber", "invoiceTerms", "journalCurrentNumber", "journalPrefix", "journalStartNumber", "logoUrl", "phone", "taxId", "updatedAt" FROM "CompanySettings";
DROP TABLE "CompanySettings";
ALTER TABLE "new_CompanySettings" RENAME TO "CompanySettings";
CREATE TABLE "new_Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Item" ("createdAt", "description", "id", "name", "updatedAt") SELECT "createdAt", "description", "id", "name", "updatedAt" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE TABLE "new_JournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryNumber" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "description" TEXT,
    "reference" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "exchangeRate" REAL NOT NULL DEFAULT 1.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_JournalEntry" ("createdAt", "date", "description", "entryNumber", "id", "reference", "updatedAt") SELECT "createdAt", "date", "description", "entryNumber", "id", "reference", "updatedAt" FROM "JournalEntry";
DROP TABLE "JournalEntry";
ALTER TABLE "new_JournalEntry" RENAME TO "JournalEntry";
CREATE UNIQUE INDEX "JournalEntry_entryNumber_key" ON "JournalEntry"("entryNumber");
CREATE TABLE "new_JournalRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" REAL NOT NULL DEFAULT 0,
    "credit" REAL NOT NULL DEFAULT 0,
    "foreignDebit" REAL NOT NULL DEFAULT 0,
    "foreignCredit" REAL NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JournalRow_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JournalRow_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_JournalRow" ("accountId", "createdAt", "credit", "debit", "description", "id", "journalEntryId", "updatedAt") SELECT "accountId", "createdAt", "credit", "debit", "description", "id", "journalEntryId", "updatedAt" FROM "JournalRow";
DROP TABLE "JournalRow";
ALTER TABLE "new_JournalRow" RENAME TO "JournalRow";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
