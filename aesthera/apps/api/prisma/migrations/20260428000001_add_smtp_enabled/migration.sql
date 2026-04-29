-- Migration: add_smtp_enabled
-- Adiciona campo smtp_enabled para controle de ativação/desativação do SMTP por clínica
-- DEFAULT TRUE garante que clínicas existentes com SMTP configurado continuem funcionando.

ALTER TABLE "clinics"
  ADD COLUMN "smtp_enabled" BOOLEAN NOT NULL DEFAULT true;
