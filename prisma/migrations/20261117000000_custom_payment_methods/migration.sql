CREATE TABLE custom_payment_methods (
 id TEXT PRIMARY KEY, name VARCHAR(80) NOT NULL CHECK (length(trim(name)) > 0),
 "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX custom_payment_methods_name_key ON custom_payment_methods (lower(name));
ALTER TABLE order_payments ADD COLUMN "customMethodId" TEXT REFERENCES custom_payment_methods(id) ON DELETE SET NULL,
 ADD COLUMN "customMethodName" TEXT,
 ADD CONSTRAINT order_payment_custom_method_check CHECK ("customMethodId" IS NULL OR (method = 'OTHER' AND "customMethodName" IS NOT NULL));
