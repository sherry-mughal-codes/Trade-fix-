ALTER TABLE "Party"
ADD COLUMN IF NOT EXISTS "sellingPriceListId" TEXT,
ADD COLUMN IF NOT EXISTS "buyingPriceListId" TEXT;

CREATE TABLE IF NOT EXISTS "PriceList" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isSystemDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PriceList_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PriceListItem" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "priceListId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PriceListItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PriceList_organizationId_name_key" ON "PriceList"("organizationId", "name");
CREATE INDEX IF NOT EXISTS "PriceList_organizationId_idx" ON "PriceList"("organizationId");
CREATE INDEX IF NOT EXISTS "PriceList_type_idx" ON "PriceList"("type");

CREATE UNIQUE INDEX IF NOT EXISTS "PriceListItem_priceListId_itemId_key" ON "PriceListItem"("priceListId", "itemId");
CREATE INDEX IF NOT EXISTS "PriceListItem_organizationId_idx" ON "PriceListItem"("organizationId");
CREATE INDEX IF NOT EXISTS "PriceListItem_priceListId_idx" ON "PriceListItem"("priceListId");
CREATE INDEX IF NOT EXISTS "PriceListItem_itemId_idx" ON "PriceListItem"("itemId");

CREATE INDEX IF NOT EXISTS "Party_sellingPriceListId_idx" ON "Party"("sellingPriceListId");
CREATE INDEX IF NOT EXISTS "Party_buyingPriceListId_idx" ON "Party"("buyingPriceListId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'PriceList_organizationId_fkey'
  ) THEN
    ALTER TABLE "PriceList"
    ADD CONSTRAINT "PriceList_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'PriceListItem_organizationId_fkey'
  ) THEN
    ALTER TABLE "PriceListItem"
    ADD CONSTRAINT "PriceListItem_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'PriceListItem_priceListId_fkey'
  ) THEN
    ALTER TABLE "PriceListItem"
    ADD CONSTRAINT "PriceListItem_priceListId_fkey"
    FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'PriceListItem_itemId_fkey'
  ) THEN
    ALTER TABLE "PriceListItem"
    ADD CONSTRAINT "PriceListItem_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "Item"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Party_sellingPriceListId_fkey'
  ) THEN
    ALTER TABLE "Party"
    ADD CONSTRAINT "Party_sellingPriceListId_fkey"
    FOREIGN KEY ("sellingPriceListId") REFERENCES "PriceList"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Party_buyingPriceListId_fkey'
  ) THEN
    ALTER TABLE "Party"
    ADD CONSTRAINT "Party_buyingPriceListId_fkey"
    FOREIGN KEY ("buyingPriceListId") REFERENCES "PriceList"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

