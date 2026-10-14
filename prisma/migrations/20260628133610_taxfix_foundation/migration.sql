-- CreateTable
CREATE TABLE "TaxYear" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LitigationSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LitigationForum" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "litigationType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startMonth" INTEGER,
    "bufferDaysBeforeEnd" INTEGER NOT NULL DEFAULT 0,
    "isBillable" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CustomerServiceCommitment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerServiceCommitment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Party" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomerServiceCommitment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomerBillingProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "monthlyCharge" REAL NOT NULL,
    "invoiceCreationDay" INTEGER NOT NULL,
    "dueDayOfMonth" INTEGER,
    "dueAfterDays" INTEGER,
    "billingStartDate" DATETIME NOT NULL,
    "billingEndDate" DATETIME,
    "autoCreateInvoices" BOOLEAN NOT NULL DEFAULT true,
    "isBillable" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerBillingProfile_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Party" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServiceCycle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "commitmentId" TEXT NOT NULL,
    "cycleMonth" INTEGER NOT NULL,
    "cycleYear" INTEGER NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completedDate" DATETIME,
    "completedByEmployeeId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ServiceCycle_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Party" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServiceCycle_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServiceCycle_commitmentId_fkey" FOREIGN KEY ("commitmentId") REFERENCES "CustomerServiceCommitment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServiceCycle_completedByEmployeeId_fkey" FOREIGN KEY ("completedByEmployeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LitigationCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "litigationType" TEXT NOT NULL,
    "caseReferenceNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "taxYearId" TEXT NOT NULL,
    "taxPeriodFrom" DATETIME,
    "taxPeriodTo" DATETIME,
    "sectionId" TEXT NOT NULL,
    "forumId" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responsiblePersonId" TEXT NOT NULL,
    "responsibleManagerId" TEXT NOT NULL,
    "isBillable" BOOLEAN NOT NULL DEFAULT false,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "attachmentPath" TEXT,
    "linkedLitigationId" TEXT,
    "latestActivityAt" DATETIME,
    "latestActivityType" TEXT,
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LitigationCase_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Party" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LitigationCase_taxYearId_fkey" FOREIGN KEY ("taxYearId") REFERENCES "TaxYear" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LitigationCase_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "LitigationSection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LitigationCase_forumId_fkey" FOREIGN KEY ("forumId") REFERENCES "LitigationForum" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LitigationCase_responsiblePersonId_fkey" FOREIGN KEY ("responsiblePersonId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LitigationCase_responsibleManagerId_fkey" FOREIGN KEY ("responsibleManagerId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LitigationCase_linkedLitigationId_fkey" FOREIGN KEY ("linkedLitigationId") REFERENCES "LitigationCase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LitigationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "litigationCaseId" TEXT NOT NULL,
    "logType" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remarks" TEXT,
    "attachmentPath" TEXT,
    "eventDate" DATETIME,
    "secondEventDate" DATETIME,
    "outcomeStatus" TEXT,
    "detailsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LitigationLog_litigationCaseId_fkey" FOREIGN KEY ("litigationCaseId") REFERENCES "LitigationCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BillingCycle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "billingMonth" INTEGER NOT NULL,
    "billingYear" INTEGER NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "invoiceCreationDate" DATETIME NOT NULL,
    "invoiceDueDate" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "invoiceId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BillingCycle_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Party" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BillingCycle_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

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
INSERT INTO "new_Invoice" ("admissionCycle", "admissionId", "balanceAmount", "baseGrandTotal", "createdAt", "currency", "date", "discountTotal", "dueDate", "exchangeRate", "grandTotal", "id", "invoiceNumber", "journalEntryId", "notes", "paidAmount", "partyId", "status", "subTotal", "terms", "type", "updatedAt") SELECT "admissionCycle", "admissionId", "balanceAmount", "baseGrandTotal", "createdAt", "currency", "date", "discountTotal", "dueDate", "exchangeRate", "grandTotal", "id", "invoiceNumber", "journalEntryId", "notes", "paidAmount", "partyId", "status", "subTotal", "terms", "type", "updatedAt" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE UNIQUE INDEX "Invoice_journalEntryId_key" ON "Invoice"("journalEntryId");
CREATE INDEX "Invoice_date_idx" ON "Invoice"("date");
CREATE INDEX "Invoice_partyId_idx" ON "Invoice"("partyId");
CREATE INDEX "Invoice_admissionId_idx" ON "Invoice"("admissionId");
CREATE INDEX "Invoice_litigationCaseId_idx" ON "Invoice"("litigationCaseId");
CREATE UNIQUE INDEX "Invoice_admissionId_admissionCycle_key" ON "Invoice"("admissionId", "admissionCycle");
CREATE TABLE "new_Party" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "type" TEXT NOT NULL DEFAULT 'PATIENT',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "ntn" TEXT,
    "strn" TEXT,
    "contactPerson" TEXT,
    "companyType" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
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
INSERT INTO "new_Party" ("address", "cnic", "createdAt", "currency", "dob", "email", "emergencyContact", "gender", "guardianContact", "guardianName", "guardianRelation", "id", "name", "phone", "type", "updatedAt") SELECT "address", "cnic", "createdAt", "currency", "dob", "email", "emergencyContact", "gender", "guardianContact", "guardianName", "guardianRelation", "id", "name", "phone", "type", "updatedAt" FROM "Party";
DROP TABLE "Party";
ALTER TABLE "new_Party" RENAME TO "Party";
CREATE INDEX "Party_name_idx" ON "Party"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "TaxYear_title_key" ON "TaxYear"("title");

-- CreateIndex
CREATE UNIQUE INDEX "LitigationSection_title_key" ON "LitigationSection"("title");

-- CreateIndex
CREATE INDEX "LitigationForum_litigationType_idx" ON "LitigationForum"("litigationType");

-- CreateIndex
CREATE UNIQUE INDEX "LitigationForum_litigationType_title_key" ON "LitigationForum"("litigationType", "title");

-- CreateIndex
CREATE UNIQUE INDEX "Service_title_key" ON "Service"("title");

-- CreateIndex
CREATE INDEX "CustomerServiceCommitment_serviceId_idx" ON "CustomerServiceCommitment"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerServiceCommitment_customerId_serviceId_key" ON "CustomerServiceCommitment"("customerId", "serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerBillingProfile_customerId_key" ON "CustomerBillingProfile"("customerId");

-- CreateIndex
CREATE INDEX "ServiceCycle_status_idx" ON "ServiceCycle"("status");

-- CreateIndex
CREATE INDEX "ServiceCycle_dueDate_idx" ON "ServiceCycle"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCycle_customerId_serviceId_cycleMonth_cycleYear_key" ON "ServiceCycle"("customerId", "serviceId", "cycleMonth", "cycleYear");

-- CreateIndex
CREATE INDEX "LitigationCase_customerId_idx" ON "LitigationCase"("customerId");

-- CreateIndex
CREATE INDEX "LitigationCase_status_idx" ON "LitigationCase"("status");

-- CreateIndex
CREATE INDEX "LitigationCase_date_idx" ON "LitigationCase"("date");

-- CreateIndex
CREATE INDEX "LitigationCase_responsiblePersonId_idx" ON "LitigationCase"("responsiblePersonId");

-- CreateIndex
CREATE INDEX "LitigationCase_responsibleManagerId_idx" ON "LitigationCase"("responsibleManagerId");

-- CreateIndex
CREATE UNIQUE INDEX "LitigationCase_litigationType_caseReferenceNumber_key" ON "LitigationCase"("litigationType", "caseReferenceNumber");

-- CreateIndex
CREATE INDEX "LitigationLog_litigationCaseId_idx" ON "LitigationLog"("litigationCaseId");

-- CreateIndex
CREATE INDEX "LitigationLog_logType_idx" ON "LitigationLog"("logType");

-- CreateIndex
CREATE INDEX "LitigationLog_date_idx" ON "LitigationLog"("date");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCycle_invoiceId_key" ON "BillingCycle"("invoiceId");

-- CreateIndex
CREATE INDEX "BillingCycle_status_idx" ON "BillingCycle"("status");

-- CreateIndex
CREATE INDEX "BillingCycle_invoiceCreationDate_idx" ON "BillingCycle"("invoiceCreationDate");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCycle_customerId_billingMonth_billingYear_key" ON "BillingCycle"("customerId", "billingMonth", "billingYear");
