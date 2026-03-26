-- CreateEnum (idempotente via bloco DO)
DO $$ BEGIN
  CREATE TYPE "FileUploadStatus" AS ENUM ('PENDING', 'CONFIRMED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "customer_files" ADD COLUMN IF NOT EXISTS "status" "FileUploadStatus" NOT NULL DEFAULT 'CONFIRMED';
