import type { PrismaClient } from "@generated/client";
import { AuditAction } from "@generated/client";
import { AppError } from "@shared/errors/app-error.js";
import type { AddJobPartInput } from "@shared/schemas/job.schema";
import { getAppInstance } from "../jobs/app-registry.js";
import {
  createPart as createPartRepo,
  deletePartById,
  findJobById,
  findPartWithJob,
} from "../repositories/job-part.repository.js";
import { createStockMovement } from "../repositories/stock-movement.repository.js";
import { assertJobMutable, lockMutableJob } from "../utils/job-mutations.js";
import { createAuditLog } from "./audit.service.js";
import { validateCategory } from "./catalog-category.service.js";
import { alertLowStock } from "./low-stock.service.js";
import { markStoreDirtyIfListed } from "./storefront.service.js";

export async function add(
  prisma: PrismaClient,
  jobId: string,
  input: AddJobPartInput,
  userId: string
) {
  const job = await findJobById(prisma, jobId);
  if (!job) {
    return null;
  }
  const mutabilityError = assertJobMutable(job);
  if (mutabilityError) {
    return mutabilityError;
  }

  const totalCost = input.unitPrice * input.quantity;

  // Catalog parts decrement stock atomically: the conditional raw update
  // guards against overselling when two jobs consume the last unit, and
  // RETURNING exposes the exact balance for the movement ledger.
  const result = await prisma.$transaction(async (tx) => {
    await lockMutableJob(tx, jobId);
    if (input.partId) {
      const decremented = await tx.$queryRaw<
        Array<{ stockQuantity: number | string }>
      >`
        UPDATE "parts_catalog"
        SET "stockQuantity" = "stockQuantity" - ${input.quantity}
        WHERE "id" = ${input.partId} AND "stockQuantity" >= ${input.quantity}
        RETURNING "stockQuantity"
      `;
      if (decremented.length === 0) {
        return { error: "INSUFFICIENT_STOCK" as const };
      }

      await createStockMovement(tx, {
        balanceAfter: decrementedReader(decremented),
        createdById: userId,
        partId: input.partId,
        quantity: -input.quantity,
        type: "CONSUMPTION",
      });
    }

    await validateCategory(tx, "PART", input.customCategoryId);
    const created = await createPartRepo(tx, {
      customCategory: input.customCategoryId
        ? { connect: { id: input.customCategoryId } }
        : undefined,
      category: input.category,
      job: { connect: { id: jobId } },
      part: input.partId ? { connect: { id: input.partId } } : undefined,
      partName: input.partName,
      quantity: input.quantity,
      supplierRef: input.supplierId
        ? { connect: { id: input.supplierId } }
        : undefined,
      supplier: input.supplier ?? null,
      totalCost,
      unitPrice: input.unitPrice,
      createdBy: { connect: { id: userId } },
    });

    // Alert OWNERs when this consumption pushed a catalog part to its
    // reorder level. Runs inside the same tx and swallows its own errors.
    if (input.partId) {
      const app = getAppInstance();
      if (app) {
        await alertLowStock(app, input.partId, tx);
      }
    }

    await createAuditLog(tx, {
      action: AuditAction.PART_ADDED,
      jobId,
      metadata: { partId: input.partId, totalCost },
      toValue: `${input.partName} x${input.quantity}`,
      userId,
    });

    return created;
  });

  // Consumo de um artigo listado muda o "em stock" da montra pública.
  if (input.partId && !("error" in result)) {
    await markStoreDirtyIfListed(prisma, input.partId);
  }

  return result;
}

export async function remove(
  prisma: PrismaClient,
  jobId: string,
  partId: string,
  userId: string
) {
  const part = await findPartWithJob(prisma, partId, jobId);
  if (!part) {
    return null;
  }
  const mutabilityError = assertJobMutable(part.job);
  if (mutabilityError) {
    return mutabilityError;
  }

  await prisma.$transaction(async (tx) => {
    await lockMutableJob(tx, jobId);
    const current = await findPartWithJob(tx, partId, jobId);
    if (!current) {
      throw new AppError("NOT_FOUND");
    }
    await deletePartById(tx, partId);
    // Restore stock for catalog parts consumed by this line.
    if (current.partId) {
      const updated = await tx.partsCatalog.update({
        where: { id: current.partId },
        data: { stockQuantity: { increment: current.quantity } },
        select: { stockQuantity: true },
      });
      await createStockMovement(tx, {
        balanceAfter: updated.stockQuantity,
        createdById: userId,
        partId: current.partId,
        quantity: current.quantity,
        type: "RETURN",
      });
    }
    await createAuditLog(tx, {
      action: AuditAction.PART_REMOVED,
      fromValue: `${current.partName} x${current.quantity}`,
      jobId,
      userId,
    });
  });

  if (part.partId) {
    await markStoreDirtyIfListed(prisma, part.partId);
  }

  return true;
}

function decrementedReader(
  rows: Array<{ stockQuantity: number | string }>
): number {
  // RETURNING echoes the column as written in the query — "stockQuantity",
  // camelCase and quoted — not the snake_case alias an earlier draft assumed.
  // Reading "stock_quantity" here silently yielded undefined, so every
  // CONSUMPTION movement was recorded with balanceAfter 0.
  const first = rows[0]?.stockQuantity;
  return typeof first === "string" ? Number.parseInt(first, 10) : (first ?? 0);
}
