-- Migration: feat_payment_packages_promotions (Issue #120)
-- Executa em ordem segura para dados existentes

-- ── 1. Novos enums ────────────────────────────────────────────────────────────

CREATE TYPE "PackageSessionStatus" AS ENUM ('ABERTO', 'AGENDADO', 'FINALIZADO', 'EXPIRADO');

CREATE TYPE "BillingSourceType" AS ENUM ('APPOINTMENT', 'PACKAGE_SALE', 'PRODUCT_SALE', 'MANUAL');

-- ── 2. CustomerPackageSession — status explícito ───────────────────────────────

ALTER TABLE "customer_package_sessions"
  ADD COLUMN "status" "PackageSessionStatus" NOT NULL DEFAULT 'ABERTO';

-- Retrocompatibilidade: marcar como FINALIZADO sessões que já têm usedAt
UPDATE "customer_package_sessions"
  SET "status" = 'FINALIZADO'
  WHERE "used_at" IS NOT NULL;

-- Retrocompatibilidade: marcar como AGENDADO sessões com appointmentId sem usedAt
UPDATE "customer_package_sessions"
  SET "status" = 'AGENDADO'
  WHERE "appointment_id" IS NOT NULL AND "used_at" IS NULL;

-- Novos índices
CREATE INDEX IF NOT EXISTS "customer_package_sessions_clinic_id_appointment_id_idx"
  ON "customer_package_sessions"("clinic_id", "appointment_id");

CREATE INDEX IF NOT EXISTS "customer_package_sessions_clinic_id_status_idx"
  ON "customer_package_sessions"("clinic_id", "status");

-- ── 3. Billing — appointmentId nullable + sourceType + notes ─────────────────

-- Tornar appointmentId nullable (era NOT NULL)
ALTER TABLE "billing"
  ALTER COLUMN "appointment_id" DROP NOT NULL;

-- Tornar dueDate sem @db.Date (agora é timestamp)
-- (PostgreSQL: se já era Date, converter para timestamp without timezone)
ALTER TABLE "billing"
  ALTER COLUMN "due_date" TYPE TIMESTAMP WITHOUT TIME ZONE
    USING "due_date"::TIMESTAMP WITHOUT TIME ZONE;

-- Adicionar sourceType com default retrocompatível
ALTER TABLE "billing"
  ADD COLUMN "source_type" "BillingSourceType" NOT NULL DEFAULT 'APPOINTMENT';

-- Adicionar campo notes
ALTER TABLE "billing"
  ADD COLUMN "notes" TEXT;

-- Novo índice
CREATE INDEX IF NOT EXISTS "billing_clinic_id_source_type_created_at_idx"
  ON "billing"("clinic_id", "source_type", "created_at");

-- ── 4. CustomerPackage — billingId nullable (FK reversa para Billing) ─────────

ALTER TABLE "customer_packages"
  ADD COLUMN "billing_id" TEXT;

ALTER TABLE "customer_packages"
  ADD CONSTRAINT "customer_packages_billing_id_key" UNIQUE ("billing_id");

ALTER TABLE "customer_packages"
  ADD CONSTRAINT "customer_packages_billing_id_fkey"
    FOREIGN KEY ("billing_id") REFERENCES "billing"("id") ON DELETE SET NULL;

-- ── 5. Promotion — campos novos ───────────────────────────────────────────────

ALTER TABLE "promotions"
  ADD COLUMN "applicable_product_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "promotions"
  ADD COLUMN "max_uses_per_customer" INTEGER;

-- ── 6. PromotionUsage — saleId + índice ──────────────────────────────────────

ALTER TABLE "promotion_usages"
  ADD COLUMN "sale_id" TEXT;

CREATE INDEX IF NOT EXISTS "promotion_usages_promotion_id_customer_id_idx"
  ON "promotion_usages"("promotion_id", "customer_id");
