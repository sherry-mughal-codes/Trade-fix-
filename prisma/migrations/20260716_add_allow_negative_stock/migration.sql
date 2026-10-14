ALTER TABLE "CompanySettings"
ADD COLUMN IF NOT EXISTS "allowNegativeStock" BOOLEAN NOT NULL DEFAULT FALSE;

WITH normalized_modules AS (
  SELECT
    "id",
    CASE
      WHEN "enabledModules" IS NULL THEN '[]'::jsonb
      WHEN jsonb_typeof("enabledModules"::jsonb) = 'array' THEN "enabledModules"::jsonb
      WHEN jsonb_typeof("enabledModules"::jsonb) = 'string' THEN COALESCE(("enabledModules" #>> '{}')::jsonb, '[]'::jsonb)
      ELSE '[]'::jsonb
    END AS modules
  FROM "Organization"
)
UPDATE "CompanySettings" cs
SET "allowNegativeStock" = TRUE
FROM normalized_modules nm
WHERE cs."organizationId" = nm."id"
  AND jsonb_typeof(nm.modules) = 'array'
  AND NOT (nm.modules @> '["inventory"]'::jsonb);
