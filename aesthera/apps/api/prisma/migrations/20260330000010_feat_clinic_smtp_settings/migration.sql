-- Migration: feat_clinic_smtp_settings
-- Adiciona campos de configuração SMTP por clínica

ALTER TABLE "clinics"
  ADD COLUMN "smtp_host"    TEXT,
  ADD COLUMN "smtp_port"    INTEGER,
  ADD COLUMN "smtp_user"    TEXT,
  ADD COLUMN "smtp_pass"    TEXT,
  ADD COLUMN "smtp_from"    TEXT,
  ADD COLUMN "smtp_secure"  BOOLEAN NOT NULL DEFAULT true;
