-- Atlas V2, additive only. Does not touch repairs, orders, customers or payments.
CREATE TABLE "atlas_entries" (
  "id" TEXT NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "summary" VARCHAR(600) NOT NULL,
  "content" TEXT NOT NULL,
  "category" VARCHAR(32) NOT NULL,
  "brand" VARCHAR(80),
  "model" VARCHAR(120),
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "difficulty" VARCHAR(32) NOT NULL DEFAULT 'Intermédio',
  "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  "authorId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "atlas_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "atlas_entries_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "atlas_entries_status_check" CHECK ("status" IN ('DRAFT','SHOP'))
);
CREATE INDEX "atlas_entries_status_category_updatedAt_idx" ON "atlas_entries" ("status","category","updatedAt");
CREATE INDEX "atlas_entries_authorId_updatedAt_idx" ON "atlas_entries" ("authorId","updatedAt");

CREATE TABLE "atlas_revisions" (
  "id" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "editorId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "atlas_revisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "atlas_revisions_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "atlas_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "atlas_revisions_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "atlas_revisions_entryId_number_key" ON "atlas_revisions" ("entryId","number");

CREATE TABLE "atlas_media" (
  "id" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "filename" VARCHAR(180) NOT NULL,
  "mime" VARCHAR(50) NOT NULL,
  "size" INTEGER NOT NULL,
  "caption" VARCHAR(400) NOT NULL DEFAULT '',
  "license" VARCHAR(50) NOT NULL DEFAULT 'OWN_WORK',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "atlas_media_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "atlas_media_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "atlas_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "atlas_media_size_check" CHECK ("size" > 0 AND "size" <= 5242880)
);
CREATE UNIQUE INDEX "atlas_media_storageKey_key" ON "atlas_media" ("storageKey");
CREATE INDEX "atlas_media_entryId_createdAt_idx" ON "atlas_media" ("entryId","createdAt");
