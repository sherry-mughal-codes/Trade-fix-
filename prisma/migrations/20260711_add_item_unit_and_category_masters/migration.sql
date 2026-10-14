ALTER TABLE "Item"
ADD COLUMN IF NOT EXISTS "trackBatches" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "hasExpiry" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Item"
ALTER COLUMN "trackBatches" SET DEFAULT false;

ALTER TABLE "Item"
ALTER COLUMN "hasExpiry" SET DEFAULT false;

UPDATE "Item"
SET "trackBatches" = false
WHERE "trackBatches" IS DISTINCT FROM false;

UPDATE "Item"
SET "hasExpiry" = false
WHERE "hasExpiry" IS DISTINCT FROM false;

CREATE TABLE IF NOT EXISTS "ItemUnit" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ItemUnit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ItemCategory" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ItemCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ItemUnit_organizationId_name_key" ON "ItemUnit"("organizationId", "name");
CREATE INDEX IF NOT EXISTS "ItemUnit_organizationId_idx" ON "ItemUnit"("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "ItemCategory_organizationId_name_key" ON "ItemCategory"("organizationId", "name");
CREATE INDEX IF NOT EXISTS "ItemCategory_organizationId_idx" ON "ItemCategory"("organizationId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'ItemUnit_organizationId_fkey'
  ) THEN
    ALTER TABLE "ItemUnit"
    ADD CONSTRAINT "ItemUnit_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'ItemCategory_organizationId_fkey'
  ) THEN
    ALTER TABLE "ItemCategory"
    ADD CONSTRAINT "ItemCategory_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
