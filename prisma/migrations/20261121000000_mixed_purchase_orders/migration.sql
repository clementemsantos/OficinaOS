-- Allow an order to contain both parts and finished products. All existing
-- monetary checks and the legacy header part link are preserved.
ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_money_check";
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_money_check" CHECK (
  "costGross" >= 0 AND "quoteGross" >= 0 AND "costVatRate" BETWEEN 0 AND 100
  AND "saleVatRate" BETWEEN 0 AND 100 AND "kind" IN ('PRODUCT', 'PART', 'MIXED')
  AND ("partId" IS NULL OR "kind" IN ('PART', 'MIXED'))
);
