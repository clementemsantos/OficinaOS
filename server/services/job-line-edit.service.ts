import {
  Prisma,
  type PrismaClient,
  type RepairCategory,
} from "@generated/client";
import { AppError } from "@shared/errors/app-error.js";
import type {
  EditJobPartInput,
  EditJobRepairInput,
} from "@shared/schemas/job.schema";
import { lockMutableJob } from "../utils/job-mutations.js";
import { createAuditLog } from "./audit.service.js";
import { validateCategory } from "./catalog-category.service.js";
import { markStoreDirtyIfListed } from "./storefront.service.js";

export async function editJobPart(
  prisma: PrismaClient,
  jobId: string,
  id: string,
  input: EditJobPartInput,
  userId: string
) {
  const result = await prisma.$transaction(async (tx) => {
    await lockMutableJob(tx, jobId);
    await tx.$queryRaw`SELECT "id" FROM "job_parts" WHERE "id"=${id} AND "jobId"=${jobId} FOR UPDATE`;
    const old = await tx.jobPart.findFirst({ where: { id, jobId } });
    if (!old) {
      throw new AppError("NOT_FOUND");
    }
    assertRmaPartEdit(old, input);
    if (input.customCategoryId !== old.customCategoryId) {
      await validateCategory(tx, "PART", input.customCategoryId);
    }
    const supplier = await supplierName(tx, input.supplierId, input.supplier);
    const quantity = input.quantity ?? old.quantity;
    const totalCost = new Prisma.Decimal(input.unitPrice ?? old.unitPrice).mul(
      quantity - (old.rmaQuantity ?? 0)
    );
    if (totalCost.greaterThan("99999999.99")) {
      throw new AppError("VALIDATION_ERROR");
    }
    const delta = quantity - old.quantity;
    if (old.partId && delta) {
      const rows = await tx.$queryRaw<
        { stockQuantity: number }[]
      >`UPDATE "parts_catalog" SET "stockQuantity"="stockQuantity"-${delta} WHERE "id"=${old.partId} AND "stockQuantity"-${delta} >= 0 RETURNING "stockQuantity"`;
      if (!rows.length) {
        throw new AppError("INSUFFICIENT_STOCK");
      }
      await tx.stockMovement.create({
        data: {
          partId: old.partId,
          quantity: -delta,
          balanceAfter: rows[0].stockQuantity,
          createdById: userId,
          type: delta > 0 ? "CONSUMPTION" : "RETURN",
          note: "Alteração da quantidade na reparação",
        },
      });
    }
    const data = { ...input, supplier, totalCost };
    const updated = await tx.jobPart.update({ where: { id }, data });
    await createAuditLog(tx, {
      action: "JOB_UPDATED",
      jobId,
      userId,
      metadata: {
        operation: "PART_EDITED",
        lineId: id,
        before: {
          partName: old.partName,
          quantity: old.quantity,
          unitPrice: String(old.unitPrice),
        },
        after: {
          partName: updated.partName,
          quantity,
          unitPrice: String(updated.unitPrice),
        },
      },
    });
    return updated;
  });
  if (result.partId) {
    await markStoreDirtyIfListed(prisma, result.partId);
  }
  return result;
}
export async function editJobRepair(
  prisma: PrismaClient,
  jobId: string,
  id: string,
  input: EditJobRepairInput,
  userId: string
) {
  return await prisma.$transaction(async (tx) => {
    await lockMutableJob(tx, jobId);
    const old = await tx.jobRepair.findFirst({ where: { id, jobId } });
    if (!old) {
      throw new AppError("NOT_FOUND");
    }
    if (input.customCategoryId !== old.customCategoryId) {
      await validateCategory(tx, "REPAIR", input.customCategoryId);
    }
    const updated = await tx.jobRepair.update({
      where: { id },
      data: {
        ...input,
        category: input.category as RepairCategory | undefined,
      },
    });
    await createAuditLog(tx, {
      action: "JOB_UPDATED",
      jobId,
      userId,
      metadata: {
        operation: "REPAIR_EDITED",
        lineId: id,
        before: { repairName: old.repairName, price: String(old.price) },
        after: { repairName: updated.repairName, price: String(updated.price) },
      },
    });
    return updated;
  });
}

async function supplierName(
  tx: Prisma.TransactionClient,
  id?: string | null,
  fallback?: string
) {
  if (!id) {
    return fallback;
  }
  const vendor = await tx.supplier.findUnique({ where: { id } });
  if (!vendor?.isActive) {
    throw new AppError("NOT_FOUND");
  }
  return vendor.name;
}

function assertRmaPartEdit(
  old: { rmaQuantity: number; quantity: number; unitPrice: Prisma.Decimal },
  input: EditJobPartInput
) {
  if (
    old.rmaQuantity > 0 &&
    ((input.quantity !== undefined && input.quantity !== old.quantity) ||
      (input.unitPrice !== undefined && !old.unitPrice.equals(input.unitPrice)))
  ) {
    throw new AppError("CONFLICT");
  }
}
