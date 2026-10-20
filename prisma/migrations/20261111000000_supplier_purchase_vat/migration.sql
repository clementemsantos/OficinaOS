-- Preserve current supplier behavior. Opt out explicitly for invoices without supplier VAT.
ALTER TABLE "suppliers" ADD COLUMN "chargesPurchaseVat" BOOLEAN NOT NULL DEFAULT true;
