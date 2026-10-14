/*
  Warnings:

  - You are about to drop the column `dueAfterDays` on the `CustomerBillingProfile` table. All the data in the column will be lost.
  - You are about to drop the column `companyType` on the `Party` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "CompanyType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

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
    "baseCurrency" TEXT NOT NULL DEFAULT 'PKR',
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
    "defaultExpenseGroupAccount" TEXT,
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
INSERT INTO "new_CompanySettings" ("address", "autoInvoicePackageLineDescriptionTemplate", "autoInvoiceWindowDays", "baseCurrency", "companyName", "createdAt", "dateFormat", "defaultAdmissionMonths", "defaultBankGroupAccount", "defaultCashGroupAccount", "defaultExpenseGroupAccount", "defaultMonthlyPackageAmount", "defaultPayableAccount", "defaultPurchaseAccount", "defaultReceivableAccount", "defaultSalaryExpenseAccount", "defaultSalaryPayableAccount", "defaultSalesAccount", "email", "iconUrl", "id", "invoiceCurrentNumber", "invoicePrefix", "invoiceStartNumber", "invoiceTerms", "journalCurrentNumber", "journalPrefix", "journalStartNumber", "lightLogoUrl", "logoUrl", "paymentCurrentNumber", "paymentPrefix", "paymentStartNumber", "phone", "salaryDivisionDays", "taxId", "updatedAt") SELECT "address", "autoInvoicePackageLineDescriptionTemplate", "autoInvoiceWindowDays", "baseCurrency", "companyName", "createdAt", "dateFormat", "defaultAdmissionMonths", "defaultBankGroupAccount", "defaultCashGroupAccount", "defaultExpenseGroupAccount", "defaultMonthlyPackageAmount", "defaultPayableAccount", "defaultPurchaseAccount", "defaultReceivableAccount", "defaultSalaryExpenseAccount", "defaultSalaryPayableAccount", "defaultSalesAccount", "email", "iconUrl", "id", "invoiceCurrentNumber", "invoicePrefix", "invoiceStartNumber", "invoiceTerms", "journalCurrentNumber", "journalPrefix", "journalStartNumber", "lightLogoUrl", "logoUrl", "paymentCurrentNumber", "paymentPrefix", "paymentStartNumber", "phone", "salaryDivisionDays", "taxId", "updatedAt" FROM "CompanySettings";
DROP TABLE "CompanySettings";
ALTER TABLE "new_CompanySettings" RENAME TO "CompanySettings";
CREATE TABLE "new_CustomerBillingProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "monthlyCharge" REAL NOT NULL,
    "invoiceCreationDay" INTEGER NOT NULL,
    "dueDayOfMonth" INTEGER,
    "billingStartDate" DATETIME NOT NULL,
    "billingEndDate" DATETIME,
    "autoCreateInvoices" BOOLEAN NOT NULL DEFAULT true,
    "isBillable" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerBillingProfile_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Party" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CustomerBillingProfile" ("autoCreateInvoices", "billingEndDate", "billingStartDate", "createdAt", "customerId", "dueDayOfMonth", "id", "invoiceCreationDay", "isBillable", "monthlyCharge", "notes", "updatedAt") SELECT "autoCreateInvoices", "billingEndDate", "billingStartDate", "createdAt", "customerId", "dueDayOfMonth", "id", "invoiceCreationDay", "isBillable", "monthlyCharge", "notes", "updatedAt" FROM "CustomerBillingProfile";
DROP TABLE "CustomerBillingProfile";
ALTER TABLE "new_CustomerBillingProfile" RENAME TO "CustomerBillingProfile";
CREATE UNIQUE INDEX "CustomerBillingProfile_customerId_key" ON "CustomerBillingProfile"("customerId");
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "date" DATETIME NOT NULL,
    "dueDate" DATETIME,
    "partyId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "exchangeRate" REAL NOT NULL DEFAULT 1.0,
    "subTotal" REAL NOT NULL DEFAULT 0,
    "discountTotal" REAL NOT NULL DEFAULT 0,
    "grandTotal" REAL NOT NULL DEFAULT 0,
    "baseGrandTotal" REAL NOT NULL DEFAULT 0,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "balanceAmount" REAL NOT NULL DEFAULT 0,
    "journalEntryId" TEXT,
    "admissionId" TEXT,
    "admissionCycle" INTEGER,
    "litigationCaseId" TEXT,
    "notes" TEXT,
    "terms" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_litigationCaseId_fkey" FOREIGN KEY ("litigationCaseId") REFERENCES "LitigationCase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("admissionCycle", "admissionId", "balanceAmount", "baseGrandTotal", "createdAt", "currency", "date", "discountTotal", "dueDate", "exchangeRate", "grandTotal", "id", "invoiceNumber", "journalEntryId", "litigationCaseId", "notes", "paidAmount", "partyId", "status", "subTotal", "terms", "type", "updatedAt") SELECT "admissionCycle", "admissionId", "balanceAmount", "baseGrandTotal", "createdAt", "currency", "date", "discountTotal", "dueDate", "exchangeRate", "grandTotal", "id", "invoiceNumber", "journalEntryId", "litigationCaseId", "notes", "paidAmount", "partyId", "status", "subTotal", "terms", "type", "updatedAt" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE UNIQUE INDEX "Invoice_journalEntryId_key" ON "Invoice"("journalEntryId");
CREATE INDEX "Invoice_date_idx" ON "Invoice"("date");
CREATE INDEX "Invoice_partyId_idx" ON "Invoice"("partyId");
CREATE INDEX "Invoice_admissionId_idx" ON "Invoice"("admissionId");
CREATE INDEX "Invoice_litigationCaseId_idx" ON "Invoice"("litigationCaseId");
CREATE UNIQUE INDEX "Invoice_admissionId_admissionCycle_key" ON "Invoice"("admissionId", "admissionCycle");
CREATE TABLE "new_JournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryNumber" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "description" TEXT,
    "reference" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "exchangeRate" REAL NOT NULL DEFAULT 1.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_JournalEntry" ("createdAt", "currency", "date", "description", "entryNumber", "exchangeRate", "id", "reference", "updatedAt") SELECT "createdAt", "currency", "date", "description", "entryNumber", "exchangeRate", "id", "reference", "updatedAt" FROM "JournalEntry";
DROP TABLE "JournalEntry";
ALTER TABLE "new_JournalEntry" RENAME TO "JournalEntry";
CREATE UNIQUE INDEX "JournalEntry_entryNumber_key" ON "JournalEntry"("entryNumber");
CREATE TABLE "new_Party" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "type" TEXT NOT NULL DEFAULT 'PATIENT',
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "ntn" TEXT,
    "strn" TEXT,
    "contactPerson" TEXT,
    "companyTypeId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "dob" DATETIME,
    "gender" TEXT,
    "guardianName" TEXT,
    "guardianRelation" TEXT,
    "guardianContact" TEXT,
    "emergencyContact" TEXT,
    "cnic" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Party_companyTypeId_fkey" FOREIGN KEY ("companyTypeId") REFERENCES "CompanyType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Party" ("address", "cnic", "contactPerson", "createdAt", "currency", "dob", "email", "emergencyContact", "gender", "guardianContact", "guardianName", "guardianRelation", "id", "isActive", "name", "ntn", "phone", "strn", "type", "updatedAt") SELECT "address", "cnic", "contactPerson", "createdAt", "currency", "dob", "email", "emergencyContact", "gender", "guardianContact", "guardianName", "guardianRelation", "id", "isActive", "name", "ntn", "phone", "strn", "type", "updatedAt" FROM "Party";
DROP TABLE "Party";
ALTER TABLE "new_Party" RENAME TO "Party";
CREATE UNIQUE INDEX "Party_name_key" ON "Party"("name");
CREATE INDEX "Party_name_idx" ON "Party"("name");
CREATE INDEX "Party_companyTypeId_idx" ON "Party"("companyTypeId");
CREATE TABLE "new_Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentNumber" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "partyId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "exchangeRate" REAL NOT NULL DEFAULT 1.0,
    "invoiceId" TEXT,
    "journalEntryId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Payment" ("amount", "createdAt", "currency", "date", "exchangeRate", "id", "invoiceId", "journalEntryId", "method", "notes", "partyId", "paymentNumber", "reference", "type", "updatedAt") SELECT "amount", "createdAt", "currency", "date", "exchangeRate", "id", "invoiceId", "journalEntryId", "method", "notes", "partyId", "paymentNumber", "reference", "type", "updatedAt" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
CREATE UNIQUE INDEX "Payment_paymentNumber_key" ON "Payment"("paymentNumber");
CREATE UNIQUE INDEX "Payment_journalEntryId_key" ON "Payment"("journalEntryId");
CREATE INDEX "Payment_date_idx" ON "Payment"("date");
CREATE INDEX "Payment_partyId_idx" ON "Payment"("partyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CompanyType_title_key" ON "CompanyType"("title");
