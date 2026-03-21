CREATE TABLE "supply_purchases" (
  "id" TEXT NOT NULL,
  "clinic_id" TEXT NOT NULL,
  "supply_id" TEXT NOT NULL,
  "supplier_name" TEXT,
  "purchase_unit" TEXT NOT NULL,
  "purchase_qty" DOUBLE PRECISION NOT NULL,
  "conversion_factor" DOUBLE PRECISION NOT NULL,
  "stock_increment" INTEGER NOT NULL,
  "unit_cost" INTEGER NOT NULL,
  "total_cost" INTEGER NOT NULL,
  "notes" TEXT,
  "purchased_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "supply_purchases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "supply_purchases_clinic_id_idx" ON "supply_purchases"("clinic_id");
CREATE INDEX "supply_purchases_supply_id_idx" ON "supply_purchases"("supply_id");

ALTER TABLE "supply_purchases"
ADD CONSTRAINT "supply_purchases_clinic_id_fkey"
FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "supply_purchases"
ADD CONSTRAINT "supply_purchases_supply_id_fkey"
FOREIGN KEY ("supply_id") REFERENCES "supplies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;