import { AppError } from "@shared/errors/app-error.js";
import {
  createSupplierRmaSchema,
  createSupplierSchema,
  listSupplierRmasQuerySchema,
  listSuppliersQuerySchema,
  updateSupplierRmaSchema,
  updateSupplierSchema,
} from "@shared/schemas/supplier.schema";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { z } from "zod";
import { requirePermission } from "../middlewares/rbac.js";
import {
  createRma,
  createSupplier,
  getSupplierDetail,
  listRmas,
  listSuppliers,
  updateRma,
  updateSupplier,
} from "../services/suppliers.service.js";
import { getRole, getUserId } from "../utils/request.js";
import { resolveZodErrors } from "../utils/resolve-validation-messages.js";

function parse<S extends z.ZodType>(
  schema: S,
  value: unknown,
  locale: string
): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", {
      errors: resolveZodErrors(parsed.error.flatten().fieldErrors, locale),
    });
  }
  return parsed.data;
}

async function rmaViews<T extends { deductedAmount?: unknown }>(
  req: FastifyRequest,
  rows: T[]
) {
  const allowed = await req.server.auth.api.userHasPermission({
    body: { role: getRole(req), permissions: { parts: ["viewCost"] } },
  });
  return rows.map((row) => {
    if (allowed.success) {
      return row;
    }
    const { deductedAmount: _amount, ...view } = row;
    return view;
  });
}

// Suppliers + supplier RMAs — inventory-adjacent, gated by the parts
// catalog permissions (view to read, manageCatalog to write).
// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const suppliersRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requirePermission({ parts: ["viewCatalog"] }));

  app.get("/", async (req, reply) => {
    const q = parse(listSuppliersQuerySchema, req.query, req.locale);
    const suppliers = await listSuppliers(app.prisma, {
      search: q.search,
      includeInactive: q.includeInactive === "true",
    });
    return reply.send({ data: suppliers });
  });

  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const supplier = await getSupplierDetail(app.prisma, id);
    return reply.send({
      data: { ...supplier, rmas: await rmaViews(req, supplier.rmas ?? []) },
    });
  });

  app.post(
    "/",
    { preHandler: requirePermission({ parts: ["manageCatalog"] }) },
    async (req, reply) => {
      const body = parse(createSupplierSchema, req.body, req.locale);
      const supplier = await createSupplier(app.prisma, body);
      return reply.status(201).send({ data: supplier });
    }
  );

  app.patch(
    "/:id",
    { preHandler: requirePermission({ parts: ["manageCatalog"] }) },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = parse(updateSupplierSchema, req.body, req.locale);
      const supplier = await updateSupplier(app.prisma, id, body);
      return reply.send({ data: supplier });
    }
  );
};

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const supplierRmasRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requirePermission({ parts: ["viewCatalog"] }));

  app.get("/", async (req, reply) => {
    const q = parse(listSupplierRmasQuerySchema, req.query, req.locale);
    const rmas = await listRmas(app.prisma, q);
    return reply.send({ data: await rmaViews(req, rmas) });
  });

  app.post(
    "/",
    { preHandler: requirePermission({ parts: ["manageCatalog"] }) },
    async (req, reply) => {
      const body = parse(createSupplierRmaSchema, req.body, req.locale);
      const rma = await createRma(app.prisma, body, getUserId(req));
      return reply.status(201).send({ data: (await rmaViews(req, [rma]))[0] });
    }
  );

  app.patch(
    "/:id",
    { preHandler: requirePermission({ parts: ["manageCatalog"] }) },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = parse(updateSupplierRmaSchema, req.body, req.locale);
      const rma = await updateRma(app.prisma, id, body);
      return reply.send({ data: (await rmaViews(req, [rma]))[0] });
    }
  );
};
