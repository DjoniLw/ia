-- Feature: sub-columns, textual fields, default values
-- migration: 20260329000001_feat_measurement_sub_columns_textual

-- MeasurementSheetColumn: isTextual + defaultValue
ALTER TABLE "measurement_sheet_columns"
  ADD COLUMN IF NOT EXISTS "is_textual"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "default_value" TEXT;

-- MeasurementField: isTextual + subColumns
ALTER TABLE "measurement_fields"
  ADD COLUMN IF NOT EXISTS "is_textual"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sub_columns"  TEXT[]  NOT NULL DEFAULT '{}';

-- MeasurementValue: textValue
ALTER TABLE "measurement_values"
  ADD COLUMN IF NOT EXISTS "text_value" TEXT;

-- MeasurementTabularValue: subColumn + textValue
-- 1. Adicionar sub_column como nullable primeiro
ALTER TABLE "measurement_tabular_values"
  ADD COLUMN IF NOT EXISTS "sub_column"  TEXT,
  ADD COLUMN IF NOT EXISTS "text_value"  TEXT;

-- 2. Preencher sub_column com '' nos registros existentes
UPDATE "measurement_tabular_values" SET "sub_column" = '' WHERE "sub_column" IS NULL;

-- 3. Tornar NOT NULL com default
ALTER TABLE "measurement_tabular_values"
  ALTER COLUMN "sub_column" SET NOT NULL,
  ALTER COLUMN "sub_column" SET DEFAULT '';

-- 4. Remover unique antigo e criar novo incluindo sub_column
ALTER TABLE "measurement_tabular_values"
  DROP CONSTRAINT IF EXISTS "measurement_tabular_values_sheet_record_id_field_id_sheet_col_key";

ALTER TABLE "measurement_tabular_values"
  ADD CONSTRAINT "measurement_tabular_values_sheet_record_id_field_id_sheet_col_sub_key"
  UNIQUE ("sheet_record_id", "field_id", "sheet_column_id", "sub_column");
