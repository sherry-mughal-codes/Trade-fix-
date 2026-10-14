ALTER TABLE "Item"
ADD COLUMN IF NOT EXISTS "itemCode" TEXT,
ADD COLUMN IF NOT EXISTS "category" TEXT,
ADD COLUMN IF NOT EXISTS "defaultUnit" TEXT NOT NULL DEFAULT 'Unit',
ADD COLUMN IF NOT EXISTS "itemType" TEXT NOT NULL DEFAULT 'INVENTORY',
ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "trackBatches" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "hasExpiry" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "movingAverageCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "stockOnHand" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "ItemUnitConversion" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "unitName" TEXT NOT NULL,
  "conversionFactor" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ItemUnitConversion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Item_organizationId_itemCode_key" ON "Item"("organizationId", "itemCode");
CREATE UNIQUE INDEX IF NOT EXISTS "ItemUnitConversion_itemId_unitName_key" ON "ItemUnitConversion"("itemId", "unitName");
CREATE INDEX IF NOT EXISTS "ItemUnitConversion_organizationId_idx" ON "ItemUnitConversion"("organizationId");
CREATE INDEX IF NOT EXISTS "ItemUnitConversion_itemId_idx" ON "ItemUnitConversion"("itemId");
CREATE INDEX IF NOT EXISTS "InvoiceItem_itemId_idx" ON "InvoiceItem"("itemId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'ItemUnitConversion_organizationId_fkey'
  ) THEN
    ALTER TABLE "ItemUnitConversion"
    ADD CONSTRAINT "ItemUnitConversion_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'ItemUnitConversion_itemId_fkey'
  ) THEN
    ALTER TABLE "ItemUnitConversion"
    ADD CONSTRAINT "ItemUnitConversion_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "Item"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'InvoiceItem_itemId_fkey'
  ) THEN
    ALTER TABLE "InvoiceItem"
    ADD CONSTRAINT "InvoiceItem_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "Item"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
