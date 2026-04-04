-- AddValue: WalletEntryStatus.PENDING
-- Idempotente: ADD VALUE IF NOT EXISTS requer execução fora de bloco de transação.
-- O enum "WalletEntryStatus" é o nome PascalCase gerado pelo Prisma.
ALTER TYPE "WalletEntryStatus" ADD VALUE IF NOT EXISTS 'PENDING';

-- AddValue: BillingSourceType.WALLET_PURCHASE
ALTER TYPE "BillingSourceType" ADD VALUE IF NOT EXISTS 'WALLET_PURCHASE';
