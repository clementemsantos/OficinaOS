-- Archive-only Keymaster staging. No changes to existing customer, inventory,
-- equipment, repair or supplier tables and no deletions.
CREATE TABLE "external_import_records" (
    "id" TEXT NOT NULL,
    "sourceSystem" VARCHAR(32) NOT NULL,
    "sourceEntity" VARCHAR(32) NOT NULL,
    "sourceId" VARCHAR(200) NOT NULL,
    "sourceFile" VARCHAR(255),
    "sourceRow" INTEGER NOT NULL,
    "headers" JSONB NOT NULL,
    "values" JSONB NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "external_import_records_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "external_import_records_sourceSystem_sourceEntity_sourceId_key"
    ON "external_import_records"("sourceSystem","sourceEntity","sourceId");
CREATE INDEX "external_import_records_sourceSystem_sourceEntity_idx"
    ON "external_import_records"("sourceSystem","sourceEntity");
