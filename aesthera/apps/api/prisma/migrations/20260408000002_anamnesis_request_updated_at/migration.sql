-- AlterTable: adiciona updated_at à tabela anamnesis_requests para rastreabilidade de transições de status
ALTER TABLE "anamnesis_requests" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
