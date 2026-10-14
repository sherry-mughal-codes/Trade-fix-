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
    "defaultCashGroupAccount" TEXT,
    "defaultBankGroupAccount" TEXT,
    "salaryDivisionDays" INTEGER NOT NULL DEFAULT 30,
    "defaultSalaryExpenseAccount" TEXT,
    "defaultSalaryPayableAccount" TEXT,
    "logoUrl" TEXT,
    "lightLogoUrl" TEXT,
    "iconUrl" TEXT,
    "defaultAdmissionMonths" INTEGER NOT NULL DEFAULT 1,
    "defaultMonthlyPackageAmount" REAL NOT NULL DEFAULT 0,
    "autoInvoiceWindowDays" INTEGER NOT NULL DEFAULT 0,
    "autoInvoicePackageLineDescriptionTemplate" TEXT NOT NULL DEFAULT 'Monthly Package - {Month} ({FromDate} to {ToDate})',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_CompanySettings" ("address", "autoInvoicePackageLineDescriptionTemplate", "autoInvoiceWindowDays", "baseCurrency", "companyName", "createdAt", "dateFormat", "defaultAdmissionMonths", "defaultBankGroupAccount", "defaultCashGroupAccount", "defaultPayableAccount", "defaultPurchaseAccount", "defaultReceivableAccount", "defaultSalaryExpenseAccount", "defaultSalaryPayableAccount", "defaultSalesAccount", "email", "iconUrl", "id", "invoiceCurrentNumber", "invoicePrefix", "invoiceStartNumber", "invoiceTerms", "journalCurrentNumber", "journalPrefix", "journalStartNumber", "lightLogoUrl", "logoUrl", "paymentCurrentNumber", "paymentPrefix", "paymentStartNumber", "phone", "salaryDivisionDays", "taxId", "updatedAt") SELECT "address", "autoInvoicePackageLineDescriptionTemplate", "autoInvoiceWindowDays", "baseCurrency", "companyName", "createdAt", "dateFormat", "defaultAdmissionMonths", "defaultBankGroupAccount", "defaultCashGroupAccount", "defaultPayableAccount", "defaultPurchaseAccount", "defaultReceivableAccount", "defaultSalaryExpenseAccount", "defaultSalaryPayableAccount", "defaultSalesAccount", "email", "iconUrl", "id", "invoiceCurrentNumber", "invoicePrefix", "invoiceStartNumber", "invoiceTerms", "journalCurrentNumber", "journalPrefix", "journalStartNumber", "lightLogoUrl", "logoUrl", "paymentCurrentNumber", "paymentPrefix", "paymentStartNumber", "phone", "salaryDivisionDays", "taxId", "updatedAt" FROM "CompanySettings";
DROP TABLE "CompanySettings";
ALTER TABLE "new_CompanySettings" RENAME TO "CompanySettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
