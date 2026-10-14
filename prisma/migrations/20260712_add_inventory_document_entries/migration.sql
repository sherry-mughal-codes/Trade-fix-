CREATE TABLE IF NOT EXISTS "StockEntry" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "entryNumber" TEXT NOT NULL,
  "entryType" TEXT NOT NULL DEFAULT 'OPENING',
  "date" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StockEntryItem" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "stockEntryId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "batchNumber" TEXT,
  "expiryDate" TIMESTAMP(3),
  "warehouseName" TEXT,
  "quantity" DOUBLE PRECISION NOT NULL,
  "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockEntryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StockAdjustment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "adjustmentNumber" TEXT NOT NULL,
  "adjustmentType" TEXT NOT NULL DEFAULT 'OUT',
  "date" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StockAdjustmentItem" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "stockAdjustmentId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "batchNumber" TEXT,
  "expiryDate" TIMESTAMP(3),
  "warehouseName" TEXT,
  "quantity" DOUBLE PRECISION NOT NULL,
  "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockAdjustmentItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StockEntry_organizationId_entryNumber_key"
ON "StockEntry"("organizationId", "entryNumber");

CREATE UNIQUE INDEX IF NOT EXISTS "StockAdjustment_organizationId_adjustmentNumber_key"
ON "StockAdjustment"("organizationId", "adjustmentNumber");

CREATE INDEX IF NOT EXISTS "StockEntry_organizationId_idx" ON "StockEntry"("organizationId");
CREATE INDEX IF NOT EXISTS "StockEntry_date_idx" ON "StockEntry"("date");
CREATE INDEX IF NOT EXISTS "StockEntryItem_organizationId_idx" ON "StockEntryItem"("organizationId");
CREATE INDEX IF NOT EXISTS "StockEntryItem_stockEntryId_idx" ON "StockEntryItem"("stockEntryId");
CREATE INDEX IF NOT EXISTS "StockEntryItem_itemId_idx" ON "StockEntryItem"("itemId");

CREATE INDEX IF NOT EXISTS "StockAdjustment_organizationId_idx" ON "StockAdjustment"("organizationId");
CREATE INDEX IF NOT EXISTS "StockAdjustment_date_idx" ON "StockAdjustment"("date");
CREATE INDEX IF NOT EXISTS "StockAdjustmentItem_organizationId_idx" ON "StockAdjustmentItem"("organizationId");
CREATE INDEX IF NOT EXISTS "StockAdjustmentItem_stockAdjustmentId_idx" ON "StockAdjustmentItem"("stockAdjustmentId");
CREATE INDEX IF NOT EXISTS "StockAdjustmentItem_itemId_idx" ON "StockAdjustmentItem"("itemId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockEntry_organizationId_fkey') THEN
    ALTER TABLE "StockEntry"
    ADD CONSTRAINT "StockEntry_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockEntryItem_organizationId_fkey') THEN
    ALTER TABLE "StockEntryItem"
    ADD CONSTRAINT "StockEntryItem_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockEntryItem_stockEntryId_fkey') THEN
    ALTER TABLE "StockEntryItem"
    ADD CONSTRAINT "StockEntryItem_stockEntryId_fkey"
    FOREIGN KEY ("stockEntryId") REFERENCES "StockEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockEntryItem_itemId_fkey') THEN
    ALTER TABLE "StockEntryItem"
    ADD CONSTRAINT "StockEntryItem_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockAdjustment_organizationId_fkey') THEN
    ALTER TABLE "StockAdjustment"
    ADD CONSTRAINT "StockAdjustment_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockAdjustmentItem_organizationId_fkey') THEN
    ALTER TABLE "StockAdjustmentItem"
    ADD CONSTRAINT "StockAdjustmentItem_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockAdjustmentItem_stockAdjustmentId_fkey') THEN
    ALTER TABLE "StockAdjustmentItem"
    ADD CONSTRAINT "StockAdjustmentItem_stockAdjustmentId_fkey"
    FOREIGN KEY ("stockAdjustmentId") REFERENCES "StockAdjustment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockAdjustmentItem_itemId_fkey') THEN
    ALTER TABLE "StockAdjustmentItem"
    ADD CONSTRAINT "StockAdjustmentItem_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
