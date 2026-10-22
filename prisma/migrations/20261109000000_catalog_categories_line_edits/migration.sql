-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "customCategoryId" TEXT;

-- AlterTable
ALTER TABLE "parts_catalog" ADD COLUMN     "customCategoryId" TEXT;

-- AlterTable
ALTER TABLE "job_parts" ADD COLUMN     "customCategoryId" TEXT,
ADD COLUMN     "supplierId" TEXT;

-- AlterTable
ALTER TABLE "repair_catalog" ADD COLUMN     "customCategoryId" TEXT;

-- AlterTable
ALTER TABLE "job_repairs" ADD COLUMN     "customCategoryId" TEXT;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "customCategoryId" TEXT;

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "customCategoryId" TEXT;

-- AlterTable
ALTER TABLE "support_tickets" ADD COLUMN     "customCategoryId" TEXT;

-- AlterTable
ALTER TABLE "commercial_agreements" ADD COLUMN     "customCategoryId" TEXT;

-- CreateTable
CREATE TABLE "catalog_categories" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "parentKey" TEXT NOT NULL DEFAULT '',
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "catalog_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "catalog_categories_scope_isActive_idx" ON "catalog_categories"("scope", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_categories_scope_parentKey_nameKey_key" ON "catalog_categories"("scope", "parentKey", "nameKey");

-- CreateIndex
CREATE INDEX "customers_customCategoryId_idx" ON "customers"("customCategoryId");

-- CreateIndex
CREATE INDEX "parts_catalog_customCategoryId_idx" ON "parts_catalog"("customCategoryId");

-- CreateIndex
CREATE INDEX "job_parts_supplierId_idx" ON "job_parts"("supplierId");

-- CreateIndex
CREATE INDEX "job_parts_customCategoryId_idx" ON "job_parts"("customCategoryId");

-- CreateIndex
CREATE INDEX "repair_catalog_customCategoryId_idx" ON "repair_catalog"("customCategoryId");

-- CreateIndex
CREATE INDEX "job_repairs_customCategoryId_idx" ON "job_repairs"("customCategoryId");

-- CreateIndex
CREATE INDEX "suppliers_customCategoryId_idx" ON "suppliers"("customCategoryId");

-- CreateIndex
CREATE INDEX "purchase_orders_customCategoryId_idx" ON "purchase_orders"("customCategoryId");

-- CreateIndex
CREATE INDEX "support_tickets_customCategoryId_idx" ON "support_tickets"("customCategoryId");

-- CreateIndex
CREATE INDEX "commercial_agreements_customCategoryId_idx" ON "commercial_agreements"("customCategoryId");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_customCategoryId_fkey" FOREIGN KEY ("customCategoryId") REFERENCES "catalog_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts_catalog" ADD CONSTRAINT "parts_catalog_customCategoryId_fkey" FOREIGN KEY ("customCategoryId") REFERENCES "catalog_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_parts" ADD CONSTRAINT "job_parts_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_parts" ADD CONSTRAINT "job_parts_customCategoryId_fkey" FOREIGN KEY ("customCategoryId") REFERENCES "catalog_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_catalog" ADD CONSTRAINT "repair_catalog_customCategoryId_fkey" FOREIGN KEY ("customCategoryId") REFERENCES "catalog_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_repairs" ADD CONSTRAINT "job_repairs_customCategoryId_fkey" FOREIGN KEY ("customCategoryId") REFERENCES "catalog_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_customCategoryId_fkey" FOREIGN KEY ("customCategoryId") REFERENCES "catalog_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_customCategoryId_fkey" FOREIGN KEY ("customCategoryId") REFERENCES "catalog_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_customCategoryId_fkey" FOREIGN KEY ("customCategoryId") REFERENCES "catalog_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_agreements" ADD CONSTRAINT "commercial_agreements_customCategoryId_fkey" FOREIGN KEY ("customCategoryId") REFERENCES "catalog_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_categories" ADD CONSTRAINT "catalog_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "catalog_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "catalog_categories" ADD CONSTRAINT "catalog_categories_parent_key_check"
 CHECK ("parentKey" = COALESCE("parentId", '') AND ("parentId" IS NULL OR "parentId" <> "id"));
