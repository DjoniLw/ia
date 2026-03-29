-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('pending', 'signed');

-- CreateTable: contract_templates
CREATE TABLE "contract_templates" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "storage_key" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable: customer_contracts
CREATE TABLE "customer_contracts" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'pending',
    "signature_mode" TEXT,
    "external_id" TEXT,
    "sign_link" TEXT,
    "signature" TEXT,
    "signed_pdf_key" TEXT,
    "signed_at" TIMESTAMP(3),
    "signer_ip" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "customer_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_templates_clinic_id_idx" ON "contract_templates"("clinic_id");
CREATE INDEX "customer_contracts_clinic_id_customer_id_idx" ON "customer_contracts"("clinic_id", "customer_id");

-- AddForeignKey
ALTER TABLE "contract_templates" ADD CONSTRAINT "contract_templates_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "customer_contracts" ADD CONSTRAINT "customer_contracts_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "customer_contracts" ADD CONSTRAINT "customer_contracts_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "customer_contracts" ADD CONSTRAINT "customer_contracts_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "contract_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
