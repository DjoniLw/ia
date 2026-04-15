-- Migration: add-measurement-category-scope
-- Adicionados: enums MeasurementCategory, MeasurementScope; 
-- campos: category, scope, customer_id, created_by_user_id em measurement_sheets

-- Criar enum MeasurementCategory
CREATE TYPE "MeasurementCategory" AS ENUM ('CORPORAL', 'FACIAL', 'DERMATO_FUNCIONAL', 'NUTRICIONAL', 'POSTURAL', 'PERSONALIZADA');

-- Criar enum MeasurementScope
CREATE TYPE "MeasurementScope" AS ENUM ('SYSTEM', 'CUSTOMER');

-- Adicionar colunas à tabela measurement_sheets
ALTER TABLE "measurement_sheets" ADD COLUMN "category" "MeasurementCategory" NOT NULL DEFAULT 'CORPORAL';
ALTER TABLE "measurement_sheets" ADD COLUMN "scope" "MeasurementScope" NOT NULL DEFAULT 'SYSTEM';
ALTER TABLE "measurement_sheets" ADD COLUMN "customer_id" TEXT;
ALTER TABLE "measurement_sheets" ADD COLUMN "created_by_user_id" TEXT;

-- Adicionar foreign keys
ALTER TABLE "measurement_sheets" ADD CONSTRAINT "measurement_sheets_customer_id_fkey" 
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "measurement_sheets" ADD CONSTRAINT "measurement_sheets_created_by_user_id_fkey" 
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Remover unique constraint existente (clinicId, name) — substituída por partial index
ALTER TABLE "measurement_sheets" DROP CONSTRAINT IF EXISTS "measurement_sheets_clinic_id_name_key";

-- Criar partial index: unicidade de nome apenas para fichas SYSTEM
CREATE UNIQUE INDEX "measurement_sheets_clinic_name_system_unique"
  ON "measurement_sheets" ("clinic_id", "name")
  WHERE "scope" = 'SYSTEM';

-- Criar índices de performance
CREATE INDEX "measurement_sheets_clinic_id_scope_active_idx" ON "measurement_sheets"("clinic_id", "scope", "active");
CREATE INDEX "measurement_sheets_clinic_id_customer_id_idx" ON "measurement_sheets"("clinic_id", "customer_id");
