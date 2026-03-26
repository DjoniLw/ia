-- CreateEnum
CREATE TYPE "FileUploadStatus" AS ENUM ('PENDING', 'CONFIRMED');

-- AlterTable
ALTER TABLE "customer_files" ADD COLUMN "status" "FileUploadStatus" NOT NULL DEFAULT 'CONFIRMED';
