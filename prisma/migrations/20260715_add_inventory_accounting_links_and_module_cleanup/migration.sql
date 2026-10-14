ALTER TABLE "Organization"
ALTER COLUMN "enabledModules" SET DEFAULT '["customers","invoices","payments","inventory","journal","reports","hr"]';

UPDATE "Organization"
SET "enabledModules" = CASE
  WHEN "enabledModules" IS NULL THEN '["inventory"]'::jsonb
  WHEN jsonb_typeof("enabledModules") = 'string'
    AND jsonb_typeof(("enabledModules" #>> '{}')::jsonb) = 'array'
    AND NOT ((("enabledModules" #>> '{}')::jsonb) @> '["inventory"]'::jsonb)
    THEN (("enabledModules" #>> '{}')::jsonb) || '["inventory"]'::jsonb
  WHEN jsonb_typeof("enabledModules") = 'string'
    AND jsonb_typeof(("enabledModules" #>> '{}')::jsonb) = 'array'
    THEN ("enabledModules" #>> '{}')::jsonb
  WHEN jsonb_typeof("enabledModules") = 'array' AND NOT ("enabledModules" @> '["inventory"]'::jsonb) THEN "enabledModules" || '["inventory"]'::jsonb
  ELSE "enabledModules"
END;

ALTER TABLE "Invoice"
ADD COLUMN IF NOT EXISTS "inventoryJournalEntryId" TEXT;

ALTER TABLE "StockEntry"
ADD COLUMN IF NOT EXISTS "journalEntryId" TEXT;

ALTER TABLE "StockAdjustment"
ADD COLUMN IF NOT EXISTS "journalEntryId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Invoice_inventoryJournalEntryId_key'
  ) THEN
    ALTER TABLE "Invoice"
    ADD CONSTRAINT "Invoice_inventoryJournalEntryId_key" UNIQUE ("inventoryJournalEntryId");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'StockEntry_journalEntryId_key'
  ) THEN
    ALTER TABLE "StockEntry"
    ADD CONSTRAINT "StockEntry_journalEntryId_key" UNIQUE ("journalEntryId");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'StockAdjustment_journalEntryId_key'
  ) THEN
    ALTER TABLE "StockAdjustment"
    ADD CONSTRAINT "StockAdjustment_journalEntryId_key" UNIQUE ("journalEntryId");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Invoice_inventoryJournalEntryId_fkey'
  ) THEN
    ALTER TABLE "Invoice"
    ADD CONSTRAINT "Invoice_inventoryJournalEntryId_fkey"
    FOREIGN KEY ("inventoryJournalEntryId") REFERENCES "JournalEntry"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'StockEntry_journalEntryId_fkey'
  ) THEN
    ALTER TABLE "StockEntry"
    ADD CONSTRAINT "StockEntry_journalEntryId_fkey"
    FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'StockAdjustment_journalEntryId_fkey'
  ) THEN
    ALTER TABLE "StockAdjustment"
    ADD CONSTRAINT "StockAdjustment_journalEntryId_fkey"
    FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
