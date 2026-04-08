-- CreateEnum
CREATE TYPE "AnamnesisRequestMode" AS ENUM ('blank', 'prefilled');

-- CreateEnum
CREATE TYPE "AnamnesisRequestStatus" AS ENUM ('pending', 'signed', 'expired', 'correction_requested', 'cancelled');

-- AlterTable: add anamnesis_request_id to clinical_records
ALTER TABLE "clinical_records"
  ADD COLUMN "anamnesis_request_id" TEXT;

-- CreateTable
CREATE TABLE "anamnesis_requests" (
    "id"                  TEXT NOT NULL,
    "clinic_id"           TEXT NOT NULL,
    "customer_id"         TEXT NOT NULL,
    "created_by_user_id"  TEXT NOT NULL,
    "mode"                "AnamnesisRequestMode" NOT NULL,
    "status"              "AnamnesisRequestStatus" NOT NULL DEFAULT 'pending',
    "group_id"            TEXT NOT NULL,
    "group_name"          TEXT NOT NULL,
    "questions_snapshot"  JSONB NOT NULL,
    "staff_answers"       JSONB,
    "client_answers"      JSONB,
    "signature"           TEXT,
    "signature_hash"      TEXT,
    "consent_given_at"    TIMESTAMP(3),
    "consent_text"        TEXT,
    "sign_token"          TEXT NOT NULL,
    "expires_at"          TIMESTAMP(3) NOT NULL,
    "signed_at"           TIMESTAMP(3),
    "ip_address"          TEXT,
    "user_agent"          TEXT,
    "deleted_at"          TIMESTAMP(3),
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anamnesis_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "anamnesis_requests_sign_token_key" ON "anamnesis_requests"("sign_token");

-- CreateIndex
CREATE INDEX "anamnesis_requests_clinic_id_customer_id_idx" ON "anamnesis_requests"("clinic_id", "customer_id");

-- CreateIndex
CREATE INDEX "anamnesis_requests_sign_token_idx" ON "anamnesis_requests"("sign_token");

-- CreateIndex
CREATE INDEX "anamnesis_requests_status_idx" ON "anamnesis_requests"("status");

-- CreateIndex: unique constraint on clinical_records.anamnesis_request_id
CREATE UNIQUE INDEX "clinical_records_anamnesis_request_id_key" ON "clinical_records"("anamnesis_request_id");

-- AddForeignKey: anamnesis_requests → clinics
ALTER TABLE "anamnesis_requests"
  ADD CONSTRAINT "anamnesis_requests_clinic_id_fkey"
  FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: anamnesis_requests → customers
ALTER TABLE "anamnesis_requests"
  ADD CONSTRAINT "anamnesis_requests_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: anamnesis_requests → users
ALTER TABLE "anamnesis_requests"
  ADD CONSTRAINT "anamnesis_requests_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: clinical_records → anamnesis_requests
ALTER TABLE "clinical_records"
  ADD CONSTRAINT "clinical_records_anamnesis_request_id_fkey"
  FOREIGN KEY ("anamnesis_request_id") REFERENCES "anamnesis_requests"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
