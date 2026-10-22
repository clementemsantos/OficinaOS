import {
  type JobPart,
  Prisma,
  type PrismaClient,
  type SaleItem,
  type SupplierRma,
} from "@generated/client";
import { AppError } from "@shared/errors/app-error.js";
import type { rmaDeduction } from "@shared/schemas/rma-deduction";
import type { z } from "zod";
import { claimFinancialRecord } from "../lib/financial-record-lock.js";
import { createAuditLog } from "./audit.service.js";

type DB = PrismaClient | Prisma.TransactionClient;
type Line = JobPart | SaleItem;
interface Source {
  kind: "JOB" | "SALE";
  reference: string;
}
export async function rmaSourceRecord(db: DB, source: Source) {
  const record =
    source.kind === "JOB"
      ? await db.job.findUnique({ where: { jobCode: source.reference } })
      : await db.sale.findUnique({ where: { saleCode: source.reference } });
  if (!record) {
    throw new AppError("NOT_FOUND");
  }
  return record;
}
function assertSource(
  rma: SupplierRma,
  kind: Source["kind"],
  parentId: string
) {
  if (rma.jobId && (kind !== "JOB" || rma.jobId !== parentId)) {
    throw new AppError("VALIDATION_ERROR");
  }
}
export async function rmaCandidates(
  db: PrismaClient,
  id: string,
  source: Source
) {
  const [rma, record] = await Promise.all([
    db.supplierRma.findUnique({ where: { id } }),
    rmaSourceRecord(db, source),
  ]);
  if (!rma) {
    throw new AppError("NOT_FOUND");
  }
  assertSource(rma, source.kind, record.id);
  const lines: Line[] =
    source.kind === "JOB"
      ? await db.jobPart.findMany({ where: { jobId: record.id } })
      : await db.saleItem.findMany({ where: { saleId: record.id } });
  return lines
    .filter(
      (line) =>
        (!rma.partId || line.partId === rma.partId) &&
        line.quantity - line.rmaQuantity >= rma.quantity
    )
    .map((line) => ({
      id: line.id,
      name: "partName" in line ? line.partName : line.name,
      available: line.quantity - line.rmaQuantity,
      quantity: rma.quantity,
      amount: new Prisma.Decimal(line.unitPrice).mul(rma.quantity).toFixed(2),
    }));
}
async function lockedRma(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM supplier_rmas WHERE id = ${id} FOR UPDATE`;
  const rma = await tx.supplierRma.findUnique({ where: { id } });
  if (!rma) {
    throw new AppError("NOT_FOUND");
  }
  return rma;
}
async function lockParent(
  tx: Prisma.TransactionClient,
  kind: Source["kind"],
  id: string
) {
  if (kind === "JOB") {
    await tx.$queryRaw`SELECT id FROM jobs WHERE id = ${id} FOR UPDATE`;
  } else {
    await tx.$queryRaw`SELECT id FROM sales WHERE id = ${id} FOR UPDATE`;
  }
  const record =
    kind === "JOB"
      ? await tx.job.findUnique({ where: { id } })
      : await tx.sale.findUnique({ where: { id } });
  if (!record) {
    throw new AppError("NOT_FOUND");
  }
  if (record.invoiceDocId || record.invoicedAt || record.invoiceNumber) {
    throw new AppError("ALREADY_INVOICED");
  }
  if (
    "status" in record &&
    (record.status === "CANCELLED" || record.status === "RETURNED")
  ) {
    throw new AppError("JOB_IN_TERMINAL_STATUS");
  }
}
function revision(date: Date) {
  return new Date(Math.max(Date.now(), date.getTime() + 1));
}
function assertVersion(rma: SupplierRma, expected: string) {
  if (rma.updatedAt.toISOString() !== expected) {
    throw new AppError("CONFLICT");
  }
}
function pieceAmount(rma: SupplierRma, line: Line | null) {
  if (
    !line ||
    (rma.partId && rma.partId !== line.partId) ||
    line.rmaQuantity + rma.quantity > line.quantity
  ) {
    throw new AppError("VALIDATION_ERROR");
  }
  const amount = new Prisma.Decimal(line.unitPrice).mul(rma.quantity);
  const current = "totalCost" in line ? line.totalCost : line.lineTotal;
  if (amount.greaterThan(current)) {
    throw new AppError("VALIDATION_ERROR");
  }
  return amount;
}
async function changePiece(
  tx: Prisma.TransactionClient,
  kind: Source["kind"],
  parentId: string,
  lineId: string,
  quantity: number,
  amount: Prisma.Decimal,
  restore: boolean
) {
  const rmaQuantity = { increment: restore ? -quantity : quantity };
  const increment = restore ? amount : amount.negated();
  if (kind === "JOB") {
    await tx.jobPart.update({
      where: { id: lineId },
      data: { rmaQuantity, totalCost: { increment } },
    });
    await tx.job.update({
      where: { id: parentId },
      data: { updatedAt: new Date() },
    });
  } else {
    await tx.saleItem.update({
      where: { id: lineId },
      data: { rmaQuantity, lineTotal: { increment } },
    });
    await tx.sale.update({
      where: { id: parentId },
      data: { total: { increment } },
    });
  }
}
async function auditDeduction(
  tx: Prisma.TransactionClient,
  rma: SupplierRma,
  kind: Source["kind"],
  parentId: string,
  lineId: string,
  amount: Prisma.Decimal,
  userId: string,
  restore: boolean
) {
  await createAuditLog(tx, {
    action: "API_MUTATION",
    jobId: kind === "JOB" ? parentId : null,
    userId,
    metadata: {
      operation: restore ? "RMA_PIECE_RESTORED" : "RMA_PIECE_DEDUCTED",
      rmaId: rma.id,
      source: kind,
      recordId: parentId,
      lineId,
      quantity: rma.quantity,
      amount: amount.toFixed(2),
    },
  });
}
export async function applyRmaDeduction(
  prisma: PrismaClient,
  id: string,
  input: z.infer<typeof rmaDeduction>,
  userId: string
) {
  let release: () => void = () => undefined;
  try {
    return await prisma.$transaction(async (tx) => {
      const rma = await lockedRma(tx, id);
      if (rma.deductedAt && !rma.deductionReversedAt) {
        const selected =
          input.kind === "JOB" ? rma.deductedJobPartId : rma.deductedSaleItemId;
        if (selected === input.lineId) {
          return rma;
        }
        throw new AppError("CONFLICT");
      }
      assertVersion(rma, input.expectedUpdatedAt);
      if (rma.status === "CANCELLED") {
        throw new AppError("CONFLICT");
      }
      const record = await rmaSourceRecord(tx, input);
      release = claimFinancialRecord(input.kind, record.id);
      await lockParent(tx, input.kind, record.id);
      assertSource(rma, input.kind, record.id);
      const line =
        input.kind === "JOB"
          ? await tx.jobPart.findFirst({
              where: { id: input.lineId, jobId: record.id },
            })
          : await tx.saleItem.findFirst({
              where: { id: input.lineId, saleId: record.id },
            });
      const amount = pieceAmount(rma, line);
      await changePiece(
        tx,
        input.kind,
        record.id,
        input.lineId,
        rma.quantity,
        amount,
        false
      );
      await auditDeduction(
        tx,
        rma,
        input.kind,
        record.id,
        input.lineId,
        amount,
        userId,
        false
      );
      return tx.supplierRma.update({
        where: { id },
        data: {
          deductedJobPartId: input.kind === "JOB" ? input.lineId : null,
          deductedSaleItemId: input.kind === "SALE" ? input.lineId : null,
          deductedAmount: amount,
          deductedAt: new Date(),
          deductionReversedAt: null,
          ...(input.kind === "JOB" ? { jobId: record.id } : {}),
          updatedAt: revision(rma.updatedAt),
        },
      });
    });
  } finally {
    release();
  }
}
export async function undoRmaDeduction(
  prisma: PrismaClient,
  id: string,
  expectedUpdatedAt: string,
  userId: string
) {
  let release: () => void = () => undefined;
  try {
    return await prisma.$transaction(async (tx) => {
      const rma = await lockedRma(tx, id);
      if (!rma.deductedAt || rma.deductionReversedAt) {
        return rma;
      }
      assertVersion(rma, expectedUpdatedAt);
      const line = rma.deductedJobPartId
        ? await tx.jobPart.findUnique({ where: { id: rma.deductedJobPartId } })
        : await tx.saleItem.findUnique({
            where: { id: rma.deductedSaleItemId ?? "" },
          });
      if (!(line && rma.deductedAmount) || line.rmaQuantity < rma.quantity) {
        throw new AppError("CONFLICT");
      }
      const kind = "jobId" in line ? "JOB" : "SALE";
      const parentId = "jobId" in line ? line.jobId : line.saleId;
      release = claimFinancialRecord(kind, parentId);
      await lockParent(tx, kind, parentId);
      await changePiece(
        tx,
        kind,
        parentId,
        line.id,
        rma.quantity,
        rma.deductedAmount,
        true
      );
      await auditDeduction(
        tx,
        rma,
        kind,
        parentId,
        line.id,
        rma.deductedAmount,
        userId,
        true
      );
      return tx.supplierRma.update({
        where: { id },
        data: {
          deductionReversedAt: new Date(),
          updatedAt: revision(rma.updatedAt),
        },
      });
    });
  } finally {
    release();
  }
}
