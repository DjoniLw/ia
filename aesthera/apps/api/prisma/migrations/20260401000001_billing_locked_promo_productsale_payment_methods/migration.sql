-- ── 1. Billing — campos para travamento de promoção no agendamento ──────────

ALTER TABLE "billing"
  ADD COLUMN "locked_promotion_code" TEXT;

ALTER TABLE "billing"
  ADD COLUMN "original_amount" INTEGER;

-- ── 2. ProductSale — múltiplas formas de pagamento ───────────────────────────

ALTER TABLE "product_sales"
  ADD COLUMN "payment_methods" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Migra dados existentes: popula payment_methods a partir de payment_method
UPDATE "product_sales"
  SET "payment_methods" = ARRAY["payment_method"]
  WHERE "payment_method" IS NOT NULL;

ALTER TABLE "product_sales"
  DROP COLUMN "payment_method";
