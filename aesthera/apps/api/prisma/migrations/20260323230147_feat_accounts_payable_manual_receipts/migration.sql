-- CreateEnum
CREATE TYPE "AccountsPayableStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateTable: accounts_payable
CREATE TABLE "accounts_payable" (
    "id"               TEXT NOT NULL,
    "clinic_id"        TEXT NOT NULL,
    "description"      TEXT NOT NULL,
    "supplier_name"    TEXT,
    "category"         TEXT,
    "amount"           INTEGER NOT NULL,
    "due_date"         TIMESTAMP(3) NOT NULL,
    "status"           "AccountsPayableStatus" NOT NULL DEFAULT 'PENDING',
    "paid_at"          TIMESTAMP(3),
    "payment_method"   TEXT,
    "notes"            TEXT,
    "origin_type"      TEXT,
    "origin_reference" TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_payable_pkey" PRIMARY KEY ("id")
);

-- CreateTable: manual_receipts
CREATE TABLE "manual_receipts" (
    "id"          TEXT NOT NULL,
    "clinic_id"   TEXT NOT NULL,
    "billing_id"  TEXT NOT NULL,
    "total_paid"  INTEGER NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes"       TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manual_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: manual_receipt_lines
CREATE TABLE "manual_receipt_lines" (
    "id"                TEXT NOT NULL,
    "manual_receipt_id" TEXT NOT NULL,
    "clinic_id"         TEXT NOT NULL,
    "payment_method"    TEXT NOT NULL,
    "amount"            INTEGER NOT NULL,
    "wallet_entry_id"   TEXT,

    CONSTRAINT "manual_receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounts_payable_clinic_id_idx" ON "accounts_payable"("clinic_id");
CREATE INDEX "accounts_payable_clinic_id_status_idx" ON "accounts_payable"("clinic_id", "status");
CREATE INDEX "accounts_payable_clinic_id_due_date_idx" ON "accounts_payable"("clinic_id", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "manual_receipts_billing_id_key" ON "manual_receipts"("billing_id");
CREATE INDEX "manual_receipts_clinic_id_idx" ON "manual_receipts"("clinic_id");

-- CreateIndex
CREATE INDEX "manual_receipt_lines_clinic_id_idx" ON "manual_receipt_lines"("clinic_id");

-- AddForeignKey
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_receipts" ADD CONSTRAINT "manual_receipts_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_receipt_lines" ADD CONSTRAINT "manual_receipt_lines_manual_receipt_id_fkey"
    FOREIGN KEY ("manual_receipt_id") REFERENCES "manual_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
