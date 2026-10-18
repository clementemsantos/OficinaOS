-- Inovito Voice: commercial calls and exclusion numbers (personal calls never persisted)
CREATE TABLE "inovito_calls" (
    "id" TEXT NOT NULL,
    "providerCallId" TEXT NOT NULL,
    "callerPhone" TEXT NOT NULL,
    "calledPhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ringing',
    "durationSeconds" INTEGER,
    "summary" TEXT,
    "customerId" TEXT,
    "startedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "inovito_calls_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inovito_excluded_numbers" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inovito_excluded_numbers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inovito_calls_providerCallId_key" ON "inovito_calls"("providerCallId");
CREATE INDEX "inovito_calls_createdAt_idx" ON "inovito_calls"("createdAt");
CREATE INDEX "inovito_calls_customerId_idx" ON "inovito_calls"("customerId");
CREATE UNIQUE INDEX "inovito_excluded_numbers_phone_key" ON "inovito_excluded_numbers"("phone");
ALTER TABLE "inovito_calls" ADD CONSTRAINT "inovito_calls_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
