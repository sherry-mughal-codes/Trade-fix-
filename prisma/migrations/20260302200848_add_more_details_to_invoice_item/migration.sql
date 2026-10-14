-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN "moreDetails" TEXT;

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
    "defaultSalesAccount" TEXT,
    "defaultPurchaseAccount" TEXT,
    "defaultReceivableAccount" TEXT,
    "defaultPayableAccount" TEXT,
    "logoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_CompanySettings" ("address", "baseCurrency", "companyName", "createdAt", "dateFormat", "defaultPayableAccount", "defaultPurchaseAccount", "defaultReceivableAccount", "defaultSalesAccount", "email", "id", "logoUrl", "phone", "taxId", "updatedAt") SELECT "address", "baseCurrency", "companyName", "createdAt", "dateFormat", "defaultPayableAccount", "defaultPurchaseAccount", "defaultReceivableAccount", "defaultSalesAccount", "email", "id", "logoUrl", "phone", "taxId", "updatedAt" FROM "CompanySettings";
DROP TABLE "CompanySettings";
ALTER TABLE "new_CompanySettings" RENAME TO "CompanySettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
