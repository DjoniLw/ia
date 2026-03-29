-- Torna template_id nullable para suportar uploads avulsos de contratos assinados
ALTER TABLE "customer_contracts" ALTER COLUMN "template_id" DROP NOT NULL;

-- Adiciona label para nome do documento quando não há template vinculado
ALTER TABLE "customer_contracts" ADD COLUMN "label" TEXT;

-- Remove a constraint de FK somente se existir (safe)
ALTER TABLE "customer_contracts" DROP CONSTRAINT IF EXISTS "customer_contracts_template_id_fkey";

-- Recria como FK opcional (somente se template_id não for null)
ALTER TABLE "customer_contracts"
  ADD CONSTRAINT "customer_contracts_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "contract_templates"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE
  NOT VALID;

ALTER TABLE "customer_contracts" VALIDATE CONSTRAINT "customer_contracts_template_id_fkey";
