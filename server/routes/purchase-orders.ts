import type { Prisma, PrismaClient } from "@generated/client";
import { orderLinesTotals, orderMargin } from "@shared/business-finance";
import {
  createOrderFields,
  updateOrderFields,
} from "@shared/schemas/order-lines";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import { requirePermission } from "../middlewares/rbac.js";
import {
  createOrder,
  ORDER_INCLUDE,
  updateOrder,
} from "../services/purchase-orders.service";
import { parseInput } from "../utils/parse-input.js";
import { getRole } from "../utils/request.js";

const ORDER_NUMBER = /^EN-(\d+)$/i;
function orderSearch({
  q,
  recordId,
  from,
  to,
}: {
  q?: string;
  recordId?: string;
  from?: string;
  to?: string;
}): Prisma.PurchaseOrderWhereInput {
  const number = Number(q?.match(ORDER_NUMBER)?.[1]);
  const contains = { contains: q, mode: "insensitive" as const };
  return {
    id: recordId,
    createdAt: {
      ...(from ? { gte: new Date(`${from}T00:00:00Z`) } : {}),
      ...(to
        ? { lt: new Date(new Date(`${to}T00:00:00Z`).getTime() + 86_400_000) }
        : {}),
    },
    ...(q
      ? {
          AND: [
            {
              OR: [
                { title: contains },
                { reference: contains },
                { customer: { name: contains } },
                { supplier: { name: contains } },
                { lines: { some: { name: contains } } },
                ...(Number.isInteger(number) &&
                number > 0 &&
                number <= 2_147_483_647
                  ? [{ number }]
                  : []),
              ],
            },
          ],
        }
      : {}),
  };
}
function stateSelection(
  stateId: string | undefined,
  records: { entityId: string }[]
): Prisma.PurchaseOrderWhereInput {
  if (!stateId) {
    return {};
  }
  const ids = records.map((row) => row.entityId);
  return { AND: [{ id: stateId === "none" ? { notIn: ids } : { in: ids } }] };
}

async function orderParties(
  prisma: PrismaClient,
  customerId?: string,
  supplierId?: string
) {
  const linked = customerId
    ? await prisma.supplier.findUnique({
        where: { customerId },
        select: { id: true },
      })
    : null;
  const supplier = supplierId
    ? await prisma.supplier.findUnique({
        where: { id: supplierId },
        select: { customerId: true },
      })
    : null;
  const customer = customerId ?? supplier?.customerId;
  const vendor = supplierId ?? linked?.id;
  return [
    ...(customer ? [{ customerId: customer }] : []),
    ...(vendor
      ? [{ supplierId: vendor }, { lines: { some: { supplierId: vendor } } }]
      : []),
  ];
}
export const purchaseOrdersRoutes: FastifyPluginAsync = (app) => {
  app.addHook("preHandler", requirePermission({ parts: ["viewCatalog"] }));
  const canViewCost = async (req: FastifyRequest) =>
    (
      await app.auth.api.userHasPermission({
        body: { role: getRole(req), permissions: { parts: ["viewCost"] } },
      })
    ).success;
  const serialize = (
    order: Awaited<ReturnType<typeof createOrder>>,
    allowed: boolean
  ) => {
    const {
      costGross,
      quoteGross,
      costVatRate,
      saleVatRate,
      recoverInputVat,
      lines = [],
      ...publicFields
    } = order;
    const publicLines = lines.map(
      ({
        costKnown: _known,
        costGross: _cost,
        quoteGross: _quote,
        costVatRate: _costVat,
        saleVatRate: _saleVat,
        recoverInputVat: _recover,
        ...line
      }) => line
    );
    if (!allowed) {
      return { ...publicFields, lines: publicLines };
    }
    const financials = {
      costGross: costGross.toString(),
      quoteGross: quoteGross.toString(),
      costVatRate: costVatRate.toString(),
      saleVatRate: saleVatRate.toString(),
      recoverInputVat,
    };
    const pricedLines = lines.map((line) => ({
      ...line,
      costGross: line.costGross.toString(),
      quoteGross: line.quoteGross.toString(),
      costVatRate: line.costVatRate.toString(),
      saleVatRate: line.saleVatRate.toString(),
    }));
    const totals = pricedLines.length
      ? orderLinesTotals(pricedLines)
      : { ...financials, margin: orderMargin(financials) };
    return {
      ...publicFields,
      ...financials,
      costGross: totals.costGross,
      quoteGross: totals.quoteGross,
      lines: pricedLines,
      costsComplete: pricedLines.every((line) => line.costKnown !== false),
      margin: pricedLines.some((line) => line.costKnown === false)
        ? undefined
        : totals.margin,
    };
  };
  app.get("/filters", async () => {
    const [states, customers, suppliers] = await Promise.all([
      app.prisma.workflowState.findMany({
        where: { entityType: "ORDER" },
        orderBy: { name: "asc" },
      }),
      app.prisma.customer.findMany({
        where: { purchaseOrders: { some: {} } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      app.prisma.supplier.findMany({
        where: {
          OR: [{ purchaseOrders: { some: {} } }, { orderLines: { some: {} } }],
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);
    return { states, customers, suppliers };
  });
  app.get("/", async (req) => {
    const {
      cursor,
      supplierId,
      customerId,
      jobId,
      recordId,
      q,
      stateId,
      kind,
      from,
      to,
    } = parseInput(
      z.object({
        q: z.string().trim().max(100).optional(),
        stateId: z.string().optional(),
        kind: z.enum(["PRODUCT", "PART", "MIXED"]).optional(),
        from: z.iso.date().optional(),
        to: z.iso.date().optional(),
        cursor: z.string().optional(),
        supplierId: z.string().optional(),
        customerId: z.string().optional(),
        jobId: z.string().optional(),
        recordId: z.string().optional(),
      }),
      req.query
    );
    const partyFilters = await orderParties(app.prisma, customerId, supplierId);
    const states = stateId
      ? await app.prisma.recordWorkflow.findMany({
          where: {
            entityType: "ORDER",
            ...(stateId === "none" ? {} : { stateId }),
          },
          select: { entityId: true },
        })
      : [];
    const viewCost = await canViewCost(req);
    const data = await app.prisma.purchaseOrder.findMany({
      where: {
        jobId,
        kind,
        AND: [
          orderSearch({ q, recordId, from, to }),
          stateSelection(stateId, states),
        ],
        ...(partyFilters.length ? { OR: partyFilters } : {}),
      },
      include: ORDER_INCLUDE,
      orderBy: { id: "desc" },
      take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const workflows = await app.prisma.recordWorkflow.findMany({
      where: {
        entityType: "ORDER",
        entityId: { in: data.map((order) => order.id) },
      },
      include: { state: { select: { id: true, name: true } } },
    });
    const byOrder = new Map(workflows.map((row) => [row.entityId, row.state]));
    return {
      data: data.map((order) => ({
        ...serialize(order, viewCost),
        workflowState: byOrder.get(order.id) ?? null,
      })),
      nextCursor: data.length === 100 ? data.at(-1)?.id : null,
    };
  });
  app.post(
    "/",
    { preHandler: requirePermission({ parts: ["manageCatalog", "viewCost"] }) },
    async (req, reply) => {
      const data = parseInput(createOrderFields, req.body);
      return reply.status(201).send({
        data: serialize(
          await createOrder(app.prisma, data),
          await canViewCost(req)
        ),
      });
    }
  );
  app.patch(
    "/:id",
    { preHandler: requirePermission({ parts: ["manageCatalog", "viewCost"] }) },
    async (req) => {
      const { id } = req.params as { id: string };
      const data = parseInput(updateOrderFields, req.body);
      return {
        data: serialize(
          await updateOrder(
            app.prisma,
            id,
            data,
            Object.keys(req.body as object)
          ),
          await canViewCost(req)
        ),
      };
    }
  );
  return Promise.resolve();
};
