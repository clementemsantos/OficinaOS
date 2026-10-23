ALTER TABLE purchase_orders ADD COLUMN "quoteStatus" TEXT NOT NULL DEFAULT 'DRAFT' CHECK ("quoteStatus" IN ('DRAFT','SENT','ACCEPTED','REJECTED')),
 ADD COLUMN "quoteDecidedAt" TIMESTAMPTZ;
CREATE TABLE order_payments (
 id TEXT PRIMARY KEY, "orderId" TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
 "requestKey" TEXT NOT NULL UNIQUE, method "PaymentMethod" NOT NULL,
 amount DECIMAL(14,2) NOT NULL CHECK (amount > 0), reference TEXT, note TEXT,
 "createdById" TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "voidedAt" TIMESTAMPTZ, "voidedById" TEXT REFERENCES users(id) ON DELETE RESTRICT, "voidReason" TEXT
);
CREATE INDEX order_payments_order_created_idx ON order_payments("orderId", "createdAt");
