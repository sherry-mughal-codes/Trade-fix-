-- Add refund numbering columns to CompanySettings (mirror of payment/invoice/purchase numbering)
-- Column order matches schema.prisma insertion order (right after paymentCurrentNumber)
ALTER TABLE "CompanySettings"
  ADD COLUMN IF NOT EXISTS "refundPrefix" TEXT NOT NULL DEFAULT 'RF-',
  ADD COLUMN IF NOT EXISTS "refundStartNumber" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "refundCurrentNumber" INTEGER NOT NULL DEFAULT 1;
