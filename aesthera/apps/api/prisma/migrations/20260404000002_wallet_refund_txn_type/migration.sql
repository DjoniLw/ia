-- Add REFUND value to WalletTransactionType enum
-- Required for billing reopen flow: when a billing paid with wallet is reopened,
-- the consumed wallet entry is restored and a REFUND transaction is recorded.
-- NOTE: This migration uses the wrong type name (snake_case). It is superseded by
-- migration 000004 which uses the correct name "WalletTransactionType" (PascalCase).
ALTER TYPE "WalletTransactionType" ADD VALUE IF NOT EXISTS 'REFUND';
