-- Additive, read-only Google OAuth connection vault. No existing rows changed.
CREATE TABLE "inovito_google_connections" (
  "userId" TEXT NOT NULL,
  "credentials" TEXT NOT NULL,
  "scopes" TEXT NOT NULL,
  "connectedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "inovito_google_connections_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "inovito_google_connections"
  ADD CONSTRAINT "inovito_google_connections_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
