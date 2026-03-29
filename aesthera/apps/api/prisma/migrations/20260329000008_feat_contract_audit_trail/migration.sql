-- Migration: #132 — audit trail na assinatura manual (IP, timestamp, hash do documento)
-- Adiciona campos de auditoria à tabela customer_contracts

ALTER TABLE "customer_contracts"
  ADD COLUMN IF NOT EXISTS "signer_user_agent" TEXT,
  ADD COLUMN IF NOT EXISTS "signer_cpf"        TEXT,
  ADD COLUMN IF NOT EXISTS "document_hash"     TEXT;
