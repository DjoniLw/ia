-- ============================================================
-- feat: uploads (Cloudflare R2 + LGPD) + medidas corporais
-- Issue #113 (uploads) + #114 (body measurements)
-- ============================================================

-- DropTable (deprecado — substituído por modelos normalizados)
DROP TABLE IF EXISTS "customer_measurements";

-- CreateEnum
CREATE TYPE "FileCategory" AS ENUM ('BEFORE_PHOTO', 'AFTER_PHOTO', 'MEASUREMENT', 'EXAM', 'OTHER');

-- AlterTable — Coluna de consentimento LGPD Art. 11I nos dados corporais sensíveis
ALTER TABLE "customers" ADD COLUMN "body_data_consent_at" TIMESTAMP(3);

-- CreateTable: customer_files
CREATE TABLE "customer_files" (
    "id"             TEXT         NOT NULL,
    "clinic_id"      TEXT         NOT NULL,
    "customer_id"    TEXT         NOT NULL,
    "record_id"      TEXT,
    "name"           TEXT         NOT NULL,
    "mime_type"      TEXT         NOT NULL,
    "size"           INTEGER      NOT NULL,
    "storage_key"    TEXT         NOT NULL,
    "category"       "FileCategory" NOT NULL,
    "deleted_at"     TIMESTAMP(3),
    "uploaded_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by_id" TEXT         NOT NULL,

    CONSTRAINT "customer_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable: body_measurement_fields
CREATE TABLE "body_measurement_fields" (
    "id"         TEXT         NOT NULL,
    "clinic_id"  TEXT         NOT NULL,
    "name"       TEXT         NOT NULL,
    "unit"       TEXT         NOT NULL,
    "order"      INTEGER      NOT NULL DEFAULT 0,
    "active"     BOOLEAN      NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "body_measurement_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable: body_measurement_records
CREATE TABLE "body_measurement_records" (
    "id"             TEXT         NOT NULL,
    "clinic_id"      TEXT         NOT NULL,
    "customer_id"    TEXT         NOT NULL,
    "recorded_at"    TIMESTAMP(3) NOT NULL,
    "notes"          TEXT,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id"  TEXT         NOT NULL,

    CONSTRAINT "body_measurement_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable: body_measurement_values
CREATE TABLE "body_measurement_values" (
    "id"         TEXT           NOT NULL,
    "clinic_id"  TEXT           NOT NULL,
    "record_id"  TEXT           NOT NULL,
    "field_id"   TEXT           NOT NULL,
    "value"      DECIMAL(10,2)  NOT NULL,

    CONSTRAINT "body_measurement_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_files_storage_key_key"
    ON "customer_files"("storage_key");

CREATE INDEX "customer_files_clinic_id_customer_id_idx"
    ON "customer_files"("clinic_id", "customer_id");

CREATE INDEX "customer_files_clinic_id_record_id_idx"
    ON "customer_files"("clinic_id", "record_id");

CREATE INDEX "body_measurement_fields_clinic_id_active_idx"
    ON "body_measurement_fields"("clinic_id", "active");

CREATE INDEX "body_measurement_fields_clinic_id_order_idx"
    ON "body_measurement_fields"("clinic_id", "order");

CREATE INDEX "body_measurement_records_clinic_id_customer_id_recorded_at_idx"
    ON "body_measurement_records"("clinic_id", "customer_id", "recorded_at");

CREATE INDEX "body_measurement_values_clinic_id_record_id_idx"
    ON "body_measurement_values"("clinic_id", "record_id");

-- AddForeignKey
ALTER TABLE "customer_files" ADD CONSTRAINT "customer_files_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "customer_files" ADD CONSTRAINT "customer_files_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "customer_files" ADD CONSTRAINT "customer_files_record_id_fkey"
    FOREIGN KEY ("record_id") REFERENCES "body_measurement_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "body_measurement_fields" ADD CONSTRAINT "body_measurement_fields_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "body_measurement_records" ADD CONSTRAINT "body_measurement_records_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "body_measurement_records" ADD CONSTRAINT "body_measurement_records_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "body_measurement_values" ADD CONSTRAINT "body_measurement_values_record_id_fkey"
    FOREIGN KEY ("record_id") REFERENCES "body_measurement_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "body_measurement_values" ADD CONSTRAINT "body_measurement_values_field_id_fkey"
    FOREIGN KEY ("field_id") REFERENCES "body_measurement_fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
