ALTER TABLE "CompanySettings"
ADD COLUMN "purchaseInvoicePrefix" TEXT NOT NULL DEFAULT 'PINV-',
ADD COLUMN "purchaseInvoiceStartNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "purchaseInvoiceCurrentNumber" INTEGER NOT NULL DEFAULT 1;
