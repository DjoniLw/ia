-- Migration: adiciona colunas e enum values que faltavam na migration inicial da tabela anamnesis_requests

-- AlterEnum: adiciona valores de status ausentes na migration 001
ALTER TYPE "AnamnesisRequestStatus" ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE "AnamnesisRequestStatus" ADD VALUE IF NOT EXISTS 'clinic_filled';
ALTER TYPE "AnamnesisRequestStatus" ADD VALUE IF NOT EXISTS 'sent_to_client';
ALTER TYPE "AnamnesisRequestStatus" ADD VALUE IF NOT EXISTS 'client_submitted';

-- AlterTable: adiciona colunas ausentes na migration 001
ALTER TABLE "anamnesis_requests"
  ADD COLUMN IF NOT EXISTS "diff_resolution" JSONB,
  ADD COLUMN IF NOT EXISTS "token_expires_at" TIMESTAMP(3);
