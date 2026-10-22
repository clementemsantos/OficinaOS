-- CreateTable
CREATE TABLE "purchase_order_lines" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "partId" TEXT,
    "supplierId" TEXT,
    "reference" TEXT,
    "purchaseUrl" TEXT,
    "costGross" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "quoteGross" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "costVatRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "saleVatRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "recoverInputVat" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_order_lines_orderId_position_idx" ON "purchase_order_lines"("orderId", "position");

-- CreateIndex
CREATE INDEX "purchase_order_lines_partId_idx" ON "purchase_order_lines"("partId");

-- CreateIndex
CREATE INDEX "purchase_order_lines_supplierId_idx" ON "purchase_order_lines"("supplierId");

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Preserve each legacy order as a single line with its existing amounts and links.
INSERT INTO "purchase_order_lines" (
  "id", "orderId", "position", "name", "quantity", "partId", "supplierId",
  "reference", "purchaseUrl", "costGross", "quoteGross", "costVatRate", "saleVatRate", "recoverInputVat"
)
SELECT 'legacy-' || o."id", o."id", 0, COALESCE(p."name", o."title"), 1,
  o."partId", o."supplierId", o."reference", o."purchaseUrl", o."costGross", o."quoteGross",
  o."costVatRate", o."saleVatRate", o."recoverInputVat"
FROM "purchase_orders" o LEFT JOIN "parts_catalog" p ON p."id" = o."partId";

ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_values_check" CHECK (
  "quantity" BETWEEN 1 AND 10000 AND "position" >= 0
  AND "costGross" >= 0 AND "quoteGross" >= 0
  AND "costVatRate" BETWEEN 0 AND 100 AND "saleVatRate" BETWEEN 0 AND 100
);
