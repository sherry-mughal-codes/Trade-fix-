-- CreateTable
CREATE TABLE "Admission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "admissionDate" DATETIME NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "monthlyPackage" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "dischargeDate" DATETIME,
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Admission_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdmissionCharge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "admissionId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" REAL NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdmissionCharge_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentPromise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "promisedDate" DATETIME NOT NULL,
    "promisedAmount" REAL,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentPromise_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "autoInvoiceWindowDays" INTEGER NOT NULL DEFAULT 0,
    "autoInvoicePackageLineDescriptionTemplate" TEXT NOT NULL DEFAULT 'Monthly Package - {Month} ({FromDate} to {ToDate})',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_CompanySettings" ("address", "baseCurrency", "companyName", "createdAt", "dateFormat", "defaultBankGroupAccount", "defaultCashGroupAccount", "defaultPayableAccount", "defaultPurchaseAccount", "defaultReceivableAccount", "defaultSalaryExpenseAccount", "defaultSalaryPayableAccount", "defaultSalesAccount", "email", "iconUrl", "id", "invoiceCurrentNumber", "invoicePrefix", "invoiceStartNumber", "invoiceTerms", "journalCurrentNumber", "journalPrefix", "journalStartNumber", "lightLogoUrl", "logoUrl", "paymentCurrentNumber", "paymentPrefix", "paymentStartNumber", "phone", "salaryDivisionDays", "taxId", "updatedAt") SELECT "address", "baseCurrency", "companyName", "createdAt", "dateFormat", "defaultBankGroupAccount", "defaultCashGroupAccount", "defaultPayableAccount", "defaultPurchaseAccount", "defaultReceivableAccount", "defaultSalaryExpenseAccount", "defaultSalaryPayableAccount", "defaultSalesAccount", "email", "iconUrl", "id", "invoiceCurrentNumber", "invoicePrefix", "invoiceStartNumber", "invoiceTerms", "journalCurrentNumber", "journalPrefix", "journalStartNumber", "lightLogoUrl", "logoUrl", "paymentCurrentNumber", "paymentPrefix", "paymentStartNumber", "phone", "salaryDivisionDays", "taxId", "updatedAt" FROM "CompanySettings";
DROP TABLE "CompanySettings";
ALTER TABLE "new_CompanySettings" RENAME TO "CompanySettings";
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
    "admissionId" TEXT,
    "admissionCycle" INTEGER,
    "notes" TEXT,
    "terms" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("balanceAmount", "baseGrandTotal", "createdAt", "currency", "date", "discountTotal", "dueDate", "exchangeRate", "grandTotal", "id", "invoiceNumber", "journalEntryId", "notes", "paidAmount", "partyId", "status", "subTotal", "terms", "type", "updatedAt") SELECT "balanceAmount", "baseGrandTotal", "createdAt", "currency", "date", "discountTotal", "dueDate", "exchangeRate", "grandTotal", "id", "invoiceNumber", "journalEntryId", "notes", "paidAmount", "partyId", "status", "subTotal", "terms", "type", "updatedAt" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE UNIQUE INDEX "Invoice_journalEntryId_key" ON "Invoice"("journalEntryId");
CREATE INDEX "Invoice_date_idx" ON "Invoice"("date");
CREATE INDEX "Invoice_partyId_idx" ON "Invoice"("partyId");
CREATE INDEX "Invoice_admissionId_idx" ON "Invoice"("admissionId");
CREATE UNIQUE INDEX "Invoice_admissionId_admissionCycle_key" ON "Invoice"("admissionId", "admissionCycle");
CREATE TABLE "new_Party" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "type" TEXT NOT NULL DEFAULT 'PATIENT',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "dob" DATETIME,
    "gender" TEXT,
    "guardianName" TEXT,
    "guardianRelation" TEXT,
    "guardianContact" TEXT,
    "emergencyContact" TEXT,
    "cnic" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Party" ("address", "createdAt", "currency", "email", "id", "name", "phone", "type", "updatedAt") SELECT "address", "createdAt", "currency", "email", "id", "name", "phone", "type", "updatedAt" FROM "Party";
DROP TABLE "Party";
ALTER TABLE "new_Party" RENAME TO "Party";
CREATE INDEX "Party_name_idx" ON "Party"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Admission_patientId_idx" ON "Admission"("patientId");

-- CreateIndex
CREATE INDEX "Admission_admissionDate_idx" ON "Admission"("admissionDate");

-- CreateIndex
CREATE INDEX "AdmissionCharge_admissionId_idx" ON "AdmissionCharge"("admissionId");

-- CreateIndex
CREATE INDEX "PaymentPromise_invoiceId_idx" ON "PaymentPromise"("invoiceId");

-- CreateIndex
CREATE INDEX "PaymentPromise_promisedDate_idx" ON "PaymentPromise"("promisedDate");
