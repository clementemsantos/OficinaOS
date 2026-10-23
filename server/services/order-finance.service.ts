import { Prisma, type PrismaClient } from "@generated/client";
import { AppError } from "@shared/errors/app-error.js";
import type {
  orderPaymentFields,
  orderQuoteFields,
} from "@shared/schemas/order-finance";
import type { z } from "zod";
import { createAuditLog } from "./audit.service.js";

async function lockedOrder(
  tx: Prisma.TransactionClient,
  id: string,
  version?: string
) {
  await tx.$queryRaw`SELECT id FROM purchase_orders WHERE id = ${id} FOR UPDATE`;
  const order = await tx.purchaseOrder.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!order) {
    throw new AppError("NOT_FOUND");
  }
  if (version && order.updatedAt.toISOString() !== version) {
    throw new AppError("CONFLICT");
  }
  return order;
}
export function orderQuoteTotal(order: {
  quoteGross: Prisma.Decimal;
  lines: { quoteGross: Prisma.Decimal; quantity: number }[];
}) {
  return order.lines.length
    ? order.lines.reduce(
        (sum, line) => sum.plus(line.quoteGross.mul(line.quantity)),
        new Prisma.Decimal(0)
      )
    : order.quoteGross;
}
function nextVersion(date: Date) {
  return new Date(Math.max(Date.now(), date.getTime() + 1));
}
export async function orderPaidTotal(
  db: PrismaClient | Prisma.TransactionClient,
  id: string
) {
  const result = await db.orderPayment.aggregate({
    where: { orderId: id, voidedAt: null },
    _sum: { amount: true },
  });
  return new Prisma.Decimal(result._sum.amount ?? 0);
}
export function recordOrderPayment(
  prisma: PrismaClient,
  id: string,
  input: z.infer<typeof orderPaymentFields>,
  userId: string
) {
  return prisma.$transaction(async (tx) => {
    const order = await lockedOrder(tx, id);
    const previous = await tx.orderPayment.findUnique({
      where: { requestKey: input.requestKey },
    });
    if (previous) {
      if (
        previous.orderId !== id ||
        previous.amount.toString() !==
          new Prisma.Decimal(input.amount).toString() ||
        previous.method !== input.method ||
        (previous.reference ?? "") !== (input.reference ?? "") ||
        (previous.note ?? "") !== (input.note ?? "")
      ) {
        throw new AppError("CONFLICT");
      }
      return previous;
    }
    if (
      order.updatedAt.toISOString() !== input.expectedUpdatedAt ||
      order.quoteStatus !== "ACCEPTED"
    ) {
      throw new AppError("CONFLICT");
    }
    const paid = await orderPaidTotal(tx, id);
    const balance = orderQuoteTotal(order).minus(paid);
    if (new Prisma.Decimal(input.amount).greaterThan(balance)) {
      throw new AppError("PAYMENT_EXCEEDS_BALANCE", {
        balanceDue: balance.toNumber(),
      });
    }
    const payment = await tx.orderPayment.create({
      data: {
        orderId: id,
        amount: input.amount,
        method: input.method,
        requestKey: input.requestKey,
        reference: input.reference,
        note: input.note,
        createdById: userId,
      },
    });
    await tx.purchaseOrder.update({
      where: { id },
      data: { updatedAt: nextVersion(order.updatedAt) },
    });
    await createAuditLog(tx, {
      action: "API_MUTATION",
      jobId: null,
      userId,
      metadata: {
        operation: "ORDER_PAYMENT_ADDED",
        orderId: id,
        paymentId: payment.id,
        amount: String(input.amount),
        method: input.method,
      },
    });
    return payment;
  });
}
export function setOrderQuote(
  prisma: PrismaClient,
  id: string,
  input: z.infer<typeof orderQuoteFields>,
  userId: string
) {
  return prisma.$transaction(async (tx) => {
    const order = await lockedOrder(tx, id, input.expectedUpdatedAt);
    if (
      input.status === "REJECTED" &&
      (await orderPaidTotal(tx, id)).greaterThan(0)
    ) {
      throw new AppError("CONFLICT");
    }
    const updated = await tx.purchaseOrder.update({
      where: { id },
      data: {
        quoteStatus: input.status,
        quoteDecidedAt: ["ACCEPTED", "REJECTED"].includes(input.status)
          ? new Date()
          : null,
        updatedAt: nextVersion(order.updatedAt),
      },
    });
    await createAuditLog(tx, {
      action: "API_MUTATION",
      jobId: null,
      userId,
      metadata: {
        operation: "ORDER_QUOTE_STATUS",
        orderId: id,
        status: input.status,
        title: order.title,
        total: orderQuoteTotal(order).toString(),
        lines: order.lines.map((line) => ({
          id: line.id,
          name: line.name,
          quantity: line.quantity,
          quoteGross: line.quoteGross.toString(),
          saleVatRate: line.saleVatRate.toString(),
        })),
      },
    });
    return updated;
  });
}
export function voidOrderPayment(
  prisma: PrismaClient,
  id: string,
  paymentId: string,
  reason: string,
  userId: string
) {
  return prisma.$transaction(async (tx) => {
    const order = await lockedOrder(tx, id);
    const payment = await tx.orderPayment.findFirst({
      where: { id: paymentId, orderId: id },
    });
    if (!payment) {
      throw new AppError("NOT_FOUND");
    }
    if (payment.voidedAt) {
      return;
    }
    await tx.orderPayment.update({
      where: { id: paymentId },
      data: { voidedAt: new Date(), voidedById: userId, voidReason: reason },
    });
    await tx.purchaseOrder.update({
      where: { id },
      data: { updatedAt: nextVersion(order.updatedAt) },
    });
    await createAuditLog(tx, {
      action: "API_MUTATION",
      jobId: null,
      userId,
      metadata: {
        operation: "ORDER_PAYMENT_VOIDED",
        orderId: id,
        paymentId,
        reason,
        amount: payment.amount.toString(),
      },
    });
  });
}
