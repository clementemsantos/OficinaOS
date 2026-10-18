-- Additive only: raw Keymaster work-order fields stay available even after
-- status or job notes are edited in the operational OficinaOS.
ALTER TABLE "jobs" ADD COLUMN "legacyImport" JSONB;
