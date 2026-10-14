CREATE TABLE IF NOT EXISTS "InventoryBatchMaster" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryBatchMaster_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InventoryWarehouse" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryWarehouse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryBatchMaster_organizationId_name_key"
ON "InventoryBatchMaster"("organizationId", "name");

CREATE INDEX IF NOT EXISTS "InventoryBatchMaster_organizationId_idx"
ON "InventoryBatchMaster"("organizationId");

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryWarehouse_organizationId_name_key"
ON "InventoryWarehouse"("organizationId", "name");

CREATE INDEX IF NOT EXISTS "InventoryWarehouse_organizationId_idx"
ON "InventoryWarehouse"("organizationId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InventoryBatchMaster_organizationId_fkey'
  ) THEN
    ALTER TABLE "InventoryBatchMaster"
    ADD CONSTRAINT "InventoryBatchMaster_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InventoryWarehouse_organizationId_fkey'
  ) THEN
    ALTER TABLE "InventoryWarehouse"
    ADD CONSTRAINT "InventoryWarehouse_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
