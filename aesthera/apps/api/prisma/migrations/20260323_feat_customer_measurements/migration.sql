-- CreateTable: customer_measurements
-- Registro de medidas corporais do cliente (peso, altura, circunferências, etc.)

CREATE TABLE "customer_measurements" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "measured_at" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_measurements_clinic_id_customer_id_idx" ON "customer_measurements"("clinic_id", "customer_id");

-- AddForeignKey
ALTER TABLE "customer_measurements" ADD CONSTRAINT "customer_measurements_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_measurements" ADD CONSTRAINT "customer_measurements_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
