-- AlterTable
ALTER TABLE "users" ADD COLUMN "screen_permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
