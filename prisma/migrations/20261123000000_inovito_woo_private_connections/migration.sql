-- Independent credentials vault. No changes to sales, customers, stock or existing WooCommerce importer.
CREATE TABLE "inovito_woo_connections" (
  "origin" VARCHAR(253) NOT NULL,
  "credentials" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "inovito_woo_connections_pkey" PRIMARY KEY ("origin")
);
