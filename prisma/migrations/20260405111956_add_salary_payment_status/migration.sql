-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SalaryPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
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
INSERT INTO "new_SalaryPayment" ("amount", "createdAt", "date", "employeeId", "fromAccountId", "id", "journalEntryId", "paymentMethod", "paymentNumber", "reference", "updatedAt") SELECT "amount", "createdAt", "date", "employeeId", "fromAccountId", "id", "journalEntryId", "paymentMethod", "paymentNumber", "reference", "updatedAt" FROM "SalaryPayment";
DROP TABLE "SalaryPayment";
ALTER TABLE "new_SalaryPayment" RENAME TO "SalaryPayment";
CREATE UNIQUE INDEX "SalaryPayment_paymentNumber_key" ON "SalaryPayment"("paymentNumber");
CREATE UNIQUE INDEX "SalaryPayment_journalEntryId_key" ON "SalaryPayment"("journalEntryId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
