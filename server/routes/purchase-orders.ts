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

export const purchaseOrdersRoutes: FastifyPluginAsync = (app) => {
  app.addHook("preHandler", requirePermission({ parts: ["viewCatalog"] }));
  const serialize = async (
    req: FastifyRequest,
    order: Awaited<ReturnType<typeof createOrder>>
  ) => {
    const allowed = await app.auth.api.userHasPermission({
      body: { role: getRole(req), permissions: { parts: ["viewCost"] } },
    });
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
        costGross: _cost,
        quoteGross: _quote,
        costVatRate: _costVat,
        saleVatRate: _saleVat,
        recoverInputVat: _recover,
        ...line
      }) => line
    );
    if (!allowed.success) {
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
      margin: totals.margin,
    };
  };
  app.get("/", async (req) => {
    const { cursor, supplierId, customerId, jobId, recordId } = parseInput(
      z.object({
        cursor: z.string().optional(),
        supplierId: z.string().optional(),
        customerId: z.string().optional(),
        jobId: z.string().optional(),
        recordId: z.string().optional(),
      }),
      req.query
    );
    const linked = customerId
      ? await app.prisma.supplier.findUnique({
          where: { customerId },
          select: { id: true },
        })
      : null;
    const supplier = supplierId
      ? await app.prisma.supplier.findUnique({
          where: { id: supplierId },
          select: { customerId: true },
        })
      : null;
    const customer = customerId ?? supplier?.customerId;
    const vendor = supplierId ?? linked?.id;
    const partyFilters = [
      ...(customer ? [{ customerId: customer }] : []),
      ...(vendor
        ? [{ supplierId: vendor }, { lines: { some: { supplierId: vendor } } }]
        : []),
    ];
    const data = await app.prisma.purchaseOrder.findMany({
      where: {
        jobId,
        id: recordId,
        ...(partyFilters.length ? { OR: partyFilters } : {}),
      },
      include: ORDER_INCLUDE,
      orderBy: { id: "desc" },
      take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return {
      data: await Promise.all(data.map((order) => serialize(req, order))),
      nextCursor: data.length === 100 ? data.at(-1)?.id : null,
    };
  });
  app.post(
    "/",
    { preHandler: requirePermission({ parts: ["manageCatalog", "viewCost"] }) },
    async (req, reply) => {
      const data = parseInput(createOrderFields, req.body);
      return reply.status(201).send({
        data: await serialize(req, await createOrder(app.prisma, data)),
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
        data: await serialize(
          req,
          await updateOrder(
            app.prisma,
            id,
            data,
            Object.keys(req.body as object)
          )
        ),
      };
    }
  );
  return Promise.resolve();
};
