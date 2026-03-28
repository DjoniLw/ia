-- Fix: constraint unique de measurement_tabular_values incorreto após migration 20260329000001
--
-- Problema: a migration 20260329000001 tentou fazer DROP do constraint único de 3 colunas
-- e recriar com 4 colunas (incluindo sub_column). Porém o DROP usou um nome de 65 chars
-- enquanto o PostgreSQL armazenou o nome original (71 chars) truncado para 63 chars —
-- nomes diferentes após truncamento → DROP foi no-op → constraint antigo permaneceu.
-- Ao inserir duas sub-colunas (D e E) na mesma célula o P2002 era disparado.
--
-- Esta migration é idempotente e remove todos os candidatos possíveis
-- antes de criar o constraint correto de 4 colunas.

-- 1. Remover o constraint antigo pelo nome real armazenado pelo Postgres (63 chars)
ALTER TABLE "measurement_tabular_values"
  DROP CONSTRAINT IF EXISTS "measurement_tabular_values_sheet_record_id_field_id_sheet_colum";

-- 2. Remover variações alternativas (idempotente — IF EXISTS em todas)
ALTER TABLE "measurement_tabular_values"
  DROP CONSTRAINT IF EXISTS "measurement_tabular_values_sheet_record_id_field_id_sheet_column_id_key";

ALTER TABLE "measurement_tabular_values"
  DROP CONSTRAINT IF EXISTS "measurement_tabular_values_sheet_record_id_field_id_sheet_col_key";

-- 3. Remover o constraint de 4 colunas caso já exista (para recriar de forma limpa)
ALTER TABLE "measurement_tabular_values"
  DROP CONSTRAINT IF EXISTS "meas_tabular_val_rec_field_col_sub_uq";

ALTER TABLE "measurement_tabular_values"
  DROP CONSTRAINT IF EXISTS "measurement_tabular_values_sheet_record_id_field_id_sheet_col_sub_key";

-- 4. Garantir que sub_column existe e está corretamente configurado
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
