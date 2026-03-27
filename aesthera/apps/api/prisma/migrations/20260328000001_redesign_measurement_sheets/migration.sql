-- ============================================================
-- redesign: Fichas de Medição — tipo no nível da Ficha
-- SIMPLE/TABULAR define layout; INPUT/CHECK define tipo de campo/coluna
-- ============================================================

-- 1. Novos enums
DO $$ BEGIN
  CREATE TYPE "MeasurementSheetType" AS ENUM ('SIMPLE', 'TABULAR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MeasurementInputType" AS ENUM ('INPUT', 'CHECK');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Adicionar coluna `type` em measurement_sheets
ALTER TABLE "measurement_sheets"
  ADD COLUMN IF NOT EXISTS "type" "MeasurementSheetType" NOT NULL DEFAULT 'SIMPLE';

-- 3. Adicionar coluna `input_type` em measurement_fields
ALTER TABLE "measurement_fields"
  ADD COLUMN IF NOT EXISTS "input_type" "MeasurementInputType" NOT NULL DEFAULT 'INPUT';

-- 4. Migrar campos tipo CHECK para input_type = 'CHECK'
--    (só executa se a coluna `type` ainda existir — safe para re-run)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'measurement_fields' AND column_name = 'type'
  ) THEN
    UPDATE "measurement_fields" SET "input_type" = 'CHECK'
    WHERE "type"::text = 'CHECK';
  END IF;
END $$;

-- 5. Remover coluna `type` antiga de measurement_fields
ALTER TABLE "measurement_fields" DROP COLUMN IF EXISTS "type";

-- 6. Dropar tabelas sem dados de produção (feature em desenvolvimento)
DROP TABLE IF EXISTS "measurement_tabular_values";
DROP TABLE IF EXISTS "measurement_sub_columns";

-- 7. Criar measurement_sheet_columns (colunas de fichas TABULAR — nível ficha)
CREATE TABLE IF NOT EXISTS "measurement_sheet_columns" (
    "id"         TEXT                    NOT NULL,
    "sheet_id"   TEXT                    NOT NULL,
    "name"       TEXT                    NOT NULL,
    "input_type" "MeasurementInputType"  NOT NULL DEFAULT 'INPUT',
    "unit"       TEXT,
    "order"      INTEGER                 NOT NULL DEFAULT 0,
    CONSTRAINT "measurement_sheet_columns_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "measurement_sheet_columns"
    ADD CONSTRAINT "measurement_sheet_columns_sheet_id_fkey"
    FOREIGN KEY ("sheet_id") REFERENCES "measurement_sheets"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "measurement_sheet_columns"
    ADD CONSTRAINT "measurement_sheet_columns_sheet_id_name_key"
    UNIQUE ("sheet_id", "name");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "measurement_sheet_columns_sheet_id_order_idx"
    ON "measurement_sheet_columns"("sheet_id", "order");

-- 8. Recriar measurement_tabular_values com FK para sheet_column (não sub_column)
CREATE TABLE IF NOT EXISTS "measurement_tabular_values" (
    "id"               TEXT           NOT NULL,
    "sheet_record_id"  TEXT           NOT NULL,
    "field_id"         TEXT           NOT NULL,
    "sheet_column_id"  TEXT           NOT NULL,
    "value"            DECIMAL(10,2),
    "checked"          BOOLEAN        NOT NULL DEFAULT false,
    CONSTRAINT "measurement_tabular_values_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "measurement_tabular_values"
    ADD CONSTRAINT "measurement_tabular_values_sheet_record_id_fkey"
    FOREIGN KEY ("sheet_record_id") REFERENCES "measurement_sheet_records"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "measurement_tabular_values"
    ADD CONSTRAINT "measurement_tabular_values_field_id_fkey"
    FOREIGN KEY ("field_id") REFERENCES "measurement_fields"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "measurement_tabular_values"
    ADD CONSTRAINT "measurement_tabular_values_sheet_column_id_fkey"
    FOREIGN KEY ("sheet_column_id") REFERENCES "measurement_sheet_columns"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "measurement_tabular_values"
    ADD CONSTRAINT "measurement_tabular_values_sheet_record_id_field_id_sheet_column_id_key"
    UNIQUE ("sheet_record_id", "field_id", "sheet_column_id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 9. Atualizar measurement_values — suporte a CHECK (valor nulo + checked boolean)
ALTER TABLE "measurement_values" ALTER COLUMN "value" DROP NOT NULL;
ALTER TABLE "measurement_values" ADD COLUMN IF NOT EXISTS "checked" BOOLEAN NOT NULL DEFAULT false;

-- 10. Dropar enum antigo (somente se não houver mais referências)
DO $$ BEGIN
  DROP TYPE "MeasurementFieldType";
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
