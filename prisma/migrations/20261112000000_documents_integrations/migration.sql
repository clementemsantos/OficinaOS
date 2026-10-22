ALTER TABLE purchase_order_lines ADD COLUMN "costKnown" BOOLEAN NOT NULL DEFAULT true;
CREATE TABLE document_assets (id TEXT PRIMARY KEY, "storageKey" TEXT NOT NULL UNIQUE, name TEXT NOT NULL, size INTEGER NOT NULL CHECK(size >= 0 AND size <= 5242880), checksum TEXT NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE document_links (id TEXT PRIMARY KEY, "documentId" TEXT NOT NULL REFERENCES document_assets(id) ON DELETE CASCADE, "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL, UNIQUE("documentId", "entityType", "entityId"));
CREATE INDEX "document_links_entityType_entityId_idx" ON document_links("entityType", "entityId");
CREATE TABLE integration_connections (kind TEXT PRIMARY KEY, settings TEXT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT false, cursor TEXT, "leaseUntil" TIMESTAMPTZ, "lastSyncAt" TIMESTAMPTZ, "lastError" TEXT);
CREATE TABLE integration_receipts (id TEXT PRIMARY KEY, source TEXT NOT NULL, "externalId" TEXT NOT NULL, "recordId" TEXT NOT NULL, UNIQUE(source, "externalId"));
