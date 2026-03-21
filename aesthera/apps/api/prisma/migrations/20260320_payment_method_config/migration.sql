CREATE TABLE "payment_method_configs" (
  "id" TEXT NOT NULL,
  "clinic_id" TEXT NOT NULL,
  "pix_enabled" BOOLEAN NOT NULL DEFAULT true,
  "boleto_enabled" BOOLEAN NOT NULL DEFAULT true,
  "card_enabled" BOOLEAN NOT NULL DEFAULT true,
  "installments_enabled" BOOLEAN NOT NULL DEFAULT false,
  "installments_max_months" INTEGER NOT NULL DEFAULT 12,
  "installments_min_amount" INTEGER NOT NULL DEFAULT 10000,
  "duplicata_enabled" BOOLEAN NOT NULL DEFAULT false,
  "duplicata_days_interval" INTEGER NOT NULL DEFAULT 30,
  "duplicata_max_installments" INTEGER NOT NULL DEFAULT 6,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payment_method_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_method_configs_clinic_id_key" ON "payment_method_configs"("clinic_id");

ALTER TABLE "payment_method_configs"
ADD CONSTRAINT "payment_method_configs_clinic_id_fkey"
FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;