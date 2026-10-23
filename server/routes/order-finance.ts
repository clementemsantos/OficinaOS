import { AppError } from "@shared/errors/app-error.js";
import {
  orderPaymentFields,
  orderQuoteFields,
  voidOrderPaymentFields,
} from "@shared/schemas/order-finance";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requirePermission } from "../middlewares/rbac.js";
import {
  orderPaidTotal,
  orderQuoteTotal,
  recordOrderPayment,
  setOrderQuote,
  voidOrderPayment,
} from "../services/order-finance.service.js";
import { parseInput } from "../utils/parse-input.js";
import { getUserId } from "../utils/request.js";

const idFields = z.object({ id: z.string().min(1).max(100) });
export const orderFinanceRoutes: FastifyPluginAsync = (app) => {
  app.addHook(
    "preHandler",
    requirePermission({
      parts: ["viewCatalog", "viewCost"],
      payments: ["view"],
    })
  );
  app.get("/:id/finance", async (req) => {
    const { id } = parseInput(idFields, req.params);
    const order = await app.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!order) {
      throw new AppError("NOT_FOUND");
    }
    const [payments, paid, quotes] = await Promise.all([
      app.prisma.orderPayment.findMany({
        where: { orderId: id },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          method: true,
          amount: true,
          reference: true,
          note: true,
          createdAt: true,
          voidedAt: true,
          voidReason: true,
          createdBy: { select: { name: true, username: true } },
        },
      }),
      orderPaidTotal(app.prisma, id),
      app.prisma.auditLog.findMany({
        where: {
          AND: [
            { metadata: { path: ["orderId"], equals: id } },
            { metadata: { path: ["operation"], equals: "ORDER_QUOTE_STATUS" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, createdAt: true, metadata: true },
      }),
    ]);
    const total = orderQuoteTotal(order);
    return {
      data: {
        quoteStatus: order.quoteStatus,
        quoteDecidedAt: order.quoteDecidedAt,
        updatedAt: order.updatedAt,
        total: total.toFixed(2),
        paid: paid.toFixed(2),
        balance: total.minus(paid).toFixed(2),
        payments,
        quotes,
      },
    };
  });
  app.post(
    "/:id/quote",
    { preHandler: requirePermission({ parts: ["manageCatalog"] }) },
    async (req) => {
      const { id } = parseInput(idFields, req.params);
      await setOrderQuote(
        app.prisma,
        id,
        parseInput(orderQuoteFields, req.body),
        getUserId(req)
      );
      return { saved: true };
    }
  );
  app.post(
    "/:id/payments",
    { preHandler: requirePermission({ payments: ["create"] }) },
    async (req, reply) => {
      const { id } = parseInput(idFields, req.params);
      await recordOrderPayment(
        app.prisma,
        id,
        parseInput(orderPaymentFields, req.body),
        getUserId(req)
      );
      return reply.code(201).send({ saved: true });
    }
  );
  app.post(
    "/:id/payments/:paymentId/void",
    { preHandler: requirePermission({ payments: ["delete"] }) },
    async (req) => {
      const { id, paymentId } = parseInput(
        idFields.extend({ paymentId: z.string().min(1).max(100) }),
        req.params
      );
      const { reason } = parseInput(voidOrderPaymentFields, req.body);
      await voidOrderPayment(app.prisma, id, paymentId, reason, getUserId(req));
      return { saved: true };
    }
  );
  return Promise.resolve();
};
