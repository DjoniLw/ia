-- Fix definitivo: remove constraint único de 3 colunas em measurement_tabular_values
--
-- CONTEXTO:
--   A migration 20260329000003 tinha o SQL correto, mas foi deployada com arquivo vazio
--   (commit 9b0f1f2). O Prisma marcou-a como "aplicada" em _prisma_migrations antes do
--   conteúdo SQL chegar (commit ffbd100). Por isso o fix nunca rodou em produção.
--   Esta migration 20260329000004 é nova para o Prisma e será executada normalmente.
--
-- CONSTRAINT A REMOVER:
--   Nome real no Postgres (71 chars truncados para 63):
--   "measurement_tabular_values_sheet_record_id_field_id_sheet_colum"
--   Colunas: (sheet_record_id, field_id, sheet_column_id) — 3 colunas
--
-- OBJETIVO:
--   Substituir pelo constraint correto de 4 colunas que inclui sub_column,
--   permitindo múltiplas sub-colunas (D, E, etc.) na mesma célula de ficha tabular.

-- 1. Remover TODAS as variações possíveis do constraint antigo de 3 colunas (idempotente)
ALTER TABLE "measurement_tabular_values"
  DROP CONSTRAINT IF EXISTS "measurement_tabular_values_sheet_record_id_field_id_sheet_colum";

ALTER TABLE "measurement_tabular_values"
  DROP CONSTRAINT IF EXISTS "measurement_tabular_values_sheet_record_id_field_id_sheet_column_id_key";

ALTER TABLE "measurement_tabular_values"
  DROP CONSTRAINT IF EXISTS "measurement_tabular_values_sheet_record_id_field_id_sheet_col_key";

-- 2. Remover constraint de 4 colunas com nome longo (adicionado por 20260329000001,
--    também truncado pelo Postgres para 63 chars)
ALTER TABLE "measurement_tabular_values"
  DROP CONSTRAINT IF EXISTS "measurement_tabular_values_sheet_record_id_field_id_sheet_col_s";

ALTER TABLE "measurement_tabular_values"
  DROP CONSTRAINT IF EXISTS "measurement_tabular_values_sheet_record_id_field_id_sheet_col_sub_key";

-- 3. Remover o constraint com nome curto caso já tenha sido criado pela 20260329000003
ALTER TABLE "measurement_tabular_values"
  DROP CONSTRAINT IF EXISTS "meas_tabular_val_rec_field_col_sub_uq";

-- 4. Garantir que sub_column existe, é NOT NULL e tem DEFAULT ''
ALTER TABLE "measurement_tabular_values"
  ADD COLUMN IF NOT EXISTS "sub_column" TEXT;

UPDATE "measurement_tabular_values" SET "sub_column" = '' WHERE "sub_column" IS NULL;

ALTER TABLE "measurement_tabular_values"
  ALTER COLUMN "sub_column" SET NOT NULL,
  ALTER COLUMN "sub_column" SET DEFAULT '';

-- 5. Criar o constraint correto de 4 colunas com nome curto (< 63 chars)
DO $$ BEGIN
  ALTER TABLE "measurement_tabular_values"
    ADD CONSTRAINT "meas_tabular_val_rec_field_col_sub_uq"
    UNIQUE ("sheet_record_id", "field_id", "sheet_column_id", "sub_column");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
