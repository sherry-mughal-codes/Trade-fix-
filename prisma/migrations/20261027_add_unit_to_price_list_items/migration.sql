-- AlterTable: Add unitName to PriceListItem and backfill from Item.defaultUnit
ALTER TABLE "PriceListItem" ADD COLUMN IF NOT EXISTS "unitName" TEXT;

UPDATE "PriceListItem" pli
SET "unitName" = COALESCE(i."defaultUnit", 'Unit')
FROM "Item" i
WHERE pli."itemId" = i.id AND pli."unitName" IS NULL;

UPDATE "PriceListItem"
SET "unitName" = 'Unit'
WHERE "unitName" IS NULL;

ALTER TABLE "PriceListItem" ALTER COLUMN "unitName" SET NOT NULL;

DROP INDEX IF EXISTS "PriceListItem_priceListId_itemId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "PriceListItem_priceListId_itemId_unitName_key" ON "PriceListItem"("priceListId", "itemId", "unitName");
CREATE INDEX IF NOT EXISTS "PriceListItem_unitName_idx" ON "PriceListItem"("unitName");

