-- Inove Misto: prepare reviewed, idempotent source-to-operational synchronization.
-- This is additive except removing the phone uniqueness assumption.
-- Blank or shared phone numbers in historical exports must NOT merge customers.
DROP INDEX IF EXISTS "customers_phone_key";
CREATE INDEX IF NOT EXISTS "customers_phone_idx" ON "customers"("phone");

ALTER TABLE "external_import_records"
  ADD COLUMN IF NOT EXISTS "operationalId" TEXT,
  ADD COLUMN IF NOT EXISTS "syncedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "syncError" TEXT;

ALTER TABLE "parts_catalog"
  ADD COLUMN IF NOT EXISTS "acquisitionCost" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "priceKnown" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "sourceReference" VARCHAR(200);

ALTER TABLE "repair_catalog"
  ADD COLUMN IF NOT EXISTS "priceKnown" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "sourceReference" VARCHAR(200);

CREATE TABLE "customer_equipment" (
  "id" TEXT NOT NULL,
  "sourceSystem" VARCHAR(32) NOT NULL,
  "sourceId" VARCHAR(200) NOT NULL,
  "brand" TEXT,
  "model" TEXT,
  "category" TEXT,
  "serialNumber" TEXT,
  "customerId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_equipment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "customer_equipment_sourceSystem_sourceId_key"
  ON "customer_equipment"("sourceSystem", "sourceId");
CREATE INDEX "customer_equipment_customerId_idx" ON "customer_equipment"("customerId");
ALTER TABLE "customer_equipment" ADD CONSTRAINT "customer_equipment_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
