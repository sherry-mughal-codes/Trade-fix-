ALTER TABLE "InvoiceItem"
ADD COLUMN IF NOT EXISTS "batchNumber" TEXT,
ADD COLUMN IF NOT EXISTS "expiryDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "warehouseName" TEXT;

CREATE TABLE IF NOT EXISTS "ItemBatch" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT,
  "sourceNumber" TEXT,
  "batchNumber" TEXT,
  "expiryDate" TIMESTAMP(3),
  "warehouseName" TEXT,
  "receivedDate" TIMESTAMP(3) NOT NULL,
  "originalQty" DOUBLE PRECISION NOT NULL,
  "availableQty" DOUBLE PRECISION NOT NULL,
  "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ItemBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StockMovement" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "invoiceId" TEXT,
  "transactionDate" TIMESTAMP(3) NOT NULL,
  "direction" TEXT NOT NULL,
  "movementType" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT,
  "sourceNumber" TEXT,
  "note" TEXT,
  "quantity" DOUBLE PRECISION NOT NULL,
  "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "runningQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "runningAverageCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "batchNumber" TEXT,
  "expiryDate" TIMESTAMP(3),
  "warehouseName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ItemBatch_organizationId_idx" ON "ItemBatch"("organizationId");
CREATE INDEX IF NOT EXISTS "ItemBatch_itemId_idx" ON "ItemBatch"("itemId");
CREATE INDEX IF NOT EXISTS "ItemBatch_expiryDate_idx" ON "ItemBatch"("expiryDate");
CREATE INDEX IF NOT EXISTS "ItemBatch_sourceType_sourceId_idx" ON "ItemBatch"("sourceType", "sourceId");

CREATE INDEX IF NOT EXISTS "StockMovement_organizationId_idx" ON "StockMovement"("organizationId");
CREATE INDEX IF NOT EXISTS "StockMovement_itemId_transactionDate_idx" ON "StockMovement"("itemId", "transactionDate");
CREATE INDEX IF NOT EXISTS "StockMovement_invoiceId_idx" ON "StockMovement"("invoiceId");
CREATE INDEX IF NOT EXISTS "StockMovement_sourceType_sourceId_idx" ON "StockMovement"("sourceType", "sourceId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ItemBatch_organizationId_fkey'
  ) THEN
    ALTER TABLE "ItemBatch"
    ADD CONSTRAINT "ItemBatch_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ItemBatch_itemId_fkey'
  ) THEN
    ALTER TABLE "ItemBatch"
    ADD CONSTRAINT "ItemBatch_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_organizationId_fkey'
  ) THEN
    ALTER TABLE "StockMovement"
    ADD CONSTRAINT "StockMovement_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_itemId_fkey'
  ) THEN
    ALTER TABLE "StockMovement"
    ADD CONSTRAINT "StockMovement_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_invoiceId_fkey'
  ) THEN
    ALTER TABLE "StockMovement"
    ADD CONSTRAINT "StockMovement_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
