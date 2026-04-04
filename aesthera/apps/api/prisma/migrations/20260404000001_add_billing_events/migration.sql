-- CreateTable
CREATE TABLE "billing_events" (
    "id"          TEXT NOT NULL,
    "clinic_id"   TEXT NOT NULL,
    "billing_id"  TEXT NOT NULL,
    "event"       TEXT NOT NULL,
    "from_status" TEXT,
    "to_status"   TEXT,
    "notes"       TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "billing_events_clinic_id_billing_id_idx" ON "billing_events"("clinic_id", "billing_id");

-- CreateIndex
CREATE INDEX "billing_events_clinic_id_created_at_idx" ON "billing_events"("clinic_id", "created_at");

-- AddForeignKey
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_billing_id_fkey"
    FOREIGN KEY ("billing_id") REFERENCES "billing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
