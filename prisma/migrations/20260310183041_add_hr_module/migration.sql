-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "ctc" REAL NOT NULL DEFAULT 0,
    "joinDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SalarySlip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "ctcAmount" REAL NOT NULL,
    "absentDays" REAL NOT NULL DEFAULT 0,
    "payableAmount" REAL NOT NULL DEFAULT 0,
    "bonus" REAL NOT NULL DEFAULT 0,
    "deduction" REAL NOT NULL DEFAULT 0,
    "finalPayableAmount" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "journalEntryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SalarySlip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalarySlip_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SalaryPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "reference" TEXT,
    "fromAccountId" TEXT NOT NULL,
    "journalEntryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SalaryPayment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalaryPayment_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalaryPayment_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
    "salaryDivisionDays" INTEGER NOT NULL DEFAULT 30,
    "defaultSalaryExpenseAccount" TEXT,
    "defaultSalaryPayableAccount" TEXT,
    "logoUrl" TEXT,
    "iconUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_CompanySettings" ("address", "baseCurrency", "companyName", "createdAt", "dateFormat", "defaultPayableAccount", "defaultPurchaseAccount", "defaultReceivableAccount", "defaultSalesAccount", "email", "iconUrl", "id", "invoiceCurrentNumber", "invoicePrefix", "invoiceStartNumber", "invoiceTerms", "journalCurrentNumber", "journalPrefix", "journalStartNumber", "logoUrl", "paymentCurrentNumber", "paymentPrefix", "paymentStartNumber", "phone", "taxId", "updatedAt") SELECT "address", "baseCurrency", "companyName", "createdAt", "dateFormat", "defaultPayableAccount", "defaultPurchaseAccount", "defaultReceivableAccount", "defaultSalesAccount", "email", "iconUrl", "id", "invoiceCurrentNumber", "invoicePrefix", "invoiceStartNumber", "invoiceTerms", "journalCurrentNumber", "journalPrefix", "journalStartNumber", "logoUrl", "paymentCurrentNumber", "paymentPrefix", "paymentStartNumber", "phone", "taxId", "updatedAt" FROM "CompanySettings";
DROP TABLE "CompanySettings";
ALTER TABLE "new_CompanySettings" RENAME TO "CompanySettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SalarySlip_journalEntryId_key" ON "SalarySlip"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "SalarySlip_employeeId_month_year_key" ON "SalarySlip"("employeeId", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryPayment_paymentNumber_key" ON "SalaryPayment"("paymentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryPayment_journalEntryId_key" ON "SalaryPayment"("journalEntryId");
