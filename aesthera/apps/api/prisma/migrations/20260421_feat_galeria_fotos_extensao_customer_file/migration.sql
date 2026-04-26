-- Migration: feat-galeria-fotos-extensao-customer-file
-- Issue #163 — Galeria de Fotos do Cliente (Fase 1)
-- Não-destrutiva: apenas adiciona campos nullable e novos valores de enum

-- Adicionar novos valores ao enum FileCategory
ALTER TYPE "FileCategory" ADD VALUE IF NOT EXISTS 'PROGRESS_PHOTO';
ALTER TYPE "FileCategory" ADD VALUE IF NOT EXISTS 'GALLERY_PHOTO';

-- Adicionar novos campos à tabela customer_files
ALTER TABLE "customer_files"
  ADD COLUMN IF NOT EXISTS "taken_at"                     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "body_region"                  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "notes"                        TEXT,
  ADD COLUMN IF NOT EXISTS "deleted_by_user_id"           TEXT,
  ADD COLUMN IF NOT EXISTS "deletion_reason"              TEXT,
  ADD COLUMN IF NOT EXISTS "storage_deleted_at"           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "uploaded_by_professional_id"  TEXT;

-- FK para professionals
ALTER TABLE "customer_files"
  ADD CONSTRAINT "customer_files_uploaded_by_professional_id_fkey"
  FOREIGN KEY ("uploaded_by_professional_id")
  REFERENCES "professionals"("id")
  ON DELETE SET NULL;

-- Índices para queries da galeria
CREATE INDEX IF NOT EXISTS "customer_files_clinic_id_customer_id_deleted_at_idx"
  ON "customer_files"("clinic_id", "customer_id", "deleted_at");

CREATE INDEX IF NOT EXISTS "customer_files_clinic_id_customer_id_taken_at_idx"
  ON "customer_files"("clinic_id", "customer_id", "taken_at");
