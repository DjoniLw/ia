DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'clinics_email_key'
      AND table_name = 'clinics'
  ) THEN
    ALTER TABLE "clinics" DROP CONSTRAINT "clinics_email_key";
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'clinics_document_key'
      AND table_name = 'clinics'
  ) THEN
    ALTER TABLE "clinics" ADD CONSTRAINT "clinics_document_key" UNIQUE ("document");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TransferStatus') THEN
    CREATE TYPE "TransferStatus" AS ENUM ('pending', 'confirmed', 'rejected', 'expired');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TransferKind') THEN
    CREATE TYPE "TransferKind" AS ENUM ('clinic_registration', 'user_invite');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "transfer_tokens" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "source_clinic_id" TEXT,
  "source_user_id" TEXT,
  "target_clinic_id" TEXT NOT NULL,
  "target_user_id" TEXT,
  "role" "UserRole" NOT NULL,
  "kind" "TransferKind" NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "status" "TransferStatus" NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transfer_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "transfer_tokens_token_key" ON "transfer_tokens"("token");
CREATE INDEX IF NOT EXISTS "transfer_tokens_email_status_idx" ON "transfer_tokens"("email", "status");
CREATE INDEX IF NOT EXISTS "transfer_tokens_target_clinic_id_idx" ON "transfer_tokens"("target_clinic_id");
CREATE INDEX IF NOT EXISTS "transfer_tokens_target_user_id_idx" ON "transfer_tokens"("target_user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'transfer_tokens_source_clinic_id_fkey'
      AND table_name = 'transfer_tokens'
  ) THEN
    ALTER TABLE "transfer_tokens"
      ADD CONSTRAINT "transfer_tokens_source_clinic_id_fkey"
      FOREIGN KEY ("source_clinic_id") REFERENCES "clinics"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'transfer_tokens_source_user_id_fkey'
      AND table_name = 'transfer_tokens'
  ) THEN
    ALTER TABLE "transfer_tokens"
      ADD CONSTRAINT "transfer_tokens_source_user_id_fkey"
      FOREIGN KEY ("source_user_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'transfer_tokens_target_clinic_id_fkey'
      AND table_name = 'transfer_tokens'
  ) THEN
    ALTER TABLE "transfer_tokens"
      ADD CONSTRAINT "transfer_tokens_target_clinic_id_fkey"
      FOREIGN KEY ("target_clinic_id") REFERENCES "clinics"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'transfer_tokens_target_user_id_fkey'
      AND table_name = 'transfer_tokens'
  ) THEN
    ALTER TABLE "transfer_tokens"
      ADD CONSTRAINT "transfer_tokens_target_user_id_fkey"
      FOREIGN KEY ("target_user_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;