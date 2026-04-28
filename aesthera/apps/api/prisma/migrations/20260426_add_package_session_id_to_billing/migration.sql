-- AlterTable: add package_session_id column to billing
ALTER TABLE "billing"
  ADD COLUMN "package_session_id" TEXT;

-- CreateIndex: unique constraint on package_session_id
CREATE UNIQUE INDEX "billing_package_session_id_key" ON "billing"("package_session_id");

-- AddForeignKey
ALTER TABLE "billing"
  ADD CONSTRAINT "billing_package_session_id_fkey"
  FOREIGN KEY ("package_session_id")
  REFERENCES "customer_package_sessions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
