-- Add REFUND value to WalletTransactionType enum
-- Required for billing reopen flow: when a billing paid with wallet is reopened,
-- the consumed wallet entry is restored and a REFUND transaction is recorded.
ALTER TYPE "wallet_transaction_type" ADD VALUE 'REFUND';
