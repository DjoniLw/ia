-- AlterTable: adiciona signature_url para armazenar a URL do object storage (R2/S3) da assinatura do paciente
ALTER TABLE "anamnesis_requests" ADD COLUMN "signature_url" TEXT;
