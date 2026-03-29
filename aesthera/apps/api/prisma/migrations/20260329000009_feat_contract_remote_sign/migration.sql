-- AddColumn: sign_token e sign_token_expires_at em customer_contracts
ALTER TABLE "customer_contracts"
  ADD COLUMN IF NOT EXISTS "sign_token"            TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS "sign_token_expires_at" TIMESTAMPTZ;
