ALTER TABLE "CompanySettings"
ADD COLUMN IF NOT EXISTS "defaultInventoryAssetAccount" TEXT,
ADD COLUMN IF NOT EXISTS "defaultCogsAccount" TEXT,
ADD COLUMN IF NOT EXISTS "defaultStockAdjustmentGainAccount" TEXT,
ADD COLUMN IF NOT EXISTS "defaultStockAdjustmentLossAccount" TEXT,
ADD COLUMN IF NOT EXISTS "defaultOpeningStockAccount" TEXT;
