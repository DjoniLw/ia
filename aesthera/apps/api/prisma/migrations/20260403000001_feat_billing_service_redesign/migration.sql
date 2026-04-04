-- Migration: feat_billing_service_redesign
-- Redesenho do fluxo de cobrança de serviços (Issue #147)
-- Sem breaking changes: todos os novos campos são nullable ou têm default

-- 1. Novos valores nos enums
ALTER TYPE "BillingSourceType" ADD VALUE IF NOT EXISTS 'PRESALE';
ALTER TYPE "WalletOriginType" ADD VALUE IF NOT EXISTS 'SERVICE_PRESALE';

-- 2. Campo serviceId em billing (nullable)
ALTER TABLE "billing" ADD COLUMN IF NOT EXISTS "service_id" TEXT;
ALTER TABLE "billing" ADD CONSTRAINT "billing_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT;

-- 3. Índice em billing por serviceId
CREATE INDEX IF NOT EXISTS "billing_clinic_id_service_id_idx" ON "billing"("clinic_id", "service_id");

-- 4. Campo serviceId em wallet_entries (nullable)
ALTER TABLE "wallet_entries" ADD COLUMN IF NOT EXISTS "service_id" TEXT;
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT;

-- 5. Índice composto em wallet_entries
CREATE INDEX IF NOT EXISTS "wallet_entries_clinic_id_customer_id_service_id_status_idx"
  ON "wallet_entries"("clinic_id", "customer_id", "service_id", "status");

-- 6. Campo chargeVoucherDifference em clinics
ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "charge_voucher_difference" BOOLEAN NOT NULL DEFAULT false;
