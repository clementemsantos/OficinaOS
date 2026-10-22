ALTER TABLE job_parts ADD COLUMN "rmaQuantity" INTEGER NOT NULL DEFAULT 0 CHECK ("rmaQuantity" >= 0 AND "rmaQuantity" <= quantity);
ALTER TABLE sale_items ADD COLUMN "rmaQuantity" INTEGER NOT NULL DEFAULT 0 CHECK ("rmaQuantity" >= 0 AND "rmaQuantity" <= quantity);
ALTER TABLE supplier_rmas ADD COLUMN "deductedJobPartId" TEXT REFERENCES job_parts(id) ON DELETE SET NULL,
 ADD COLUMN "deductedSaleItemId" TEXT REFERENCES sale_items(id) ON DELETE SET NULL,
 ADD COLUMN "deductedAmount" DECIMAL(10,2), ADD COLUMN "deductedAt" TIMESTAMPTZ, ADD COLUMN "deductionReversedAt" TIMESTAMPTZ,
 ADD CONSTRAINT rma_deduction_source_check CHECK (NOT ("deductedJobPartId" IS NOT NULL AND "deductedSaleItemId" IS NOT NULL)),
 ADD CONSTRAINT rma_deduction_amount_check CHECK ("deductedAmount" IS NULL OR "deductedAmount" >= 0);
