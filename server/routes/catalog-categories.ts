import type { PermissionCheck } from "@shared/permissions";
import type { CategoryScope } from "@shared/schemas/catalog-category";
import {
  categoryFields,
  categoryScopes,
} from "@shared/schemas/catalog-category";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import { requirePermission } from "../middlewares/rbac.js";
import { saveCategory } from "../services/catalog-category.service.js";
import { parseInput } from "../utils/parse-input.js";

const view: Record<CategoryScope, PermissionCheck> = {
  PART: { parts: ["viewCatalog"] },
  REPAIR: { repairs: ["viewCatalog"] },
  CUSTOMER: { customers: ["view"] },
  SUPPLIER: { parts: ["viewCatalog"] },
  ORDER: { parts: ["viewCatalog"] },
  TICKET: { jobs: ["view"] },
  AGREEMENT: { settings: ["edit"] },
};
const edit: Record<CategoryScope, PermissionCheck> = {
  ...view,
  PART: { parts: ["manageCatalog"] },
  REPAIR: { repairs: ["manageCatalog"] },
  CUSTOMER: { customers: ["edit"] },
  SUPPLIER: { parts: ["manageCatalog"] },
  ORDER: { parts: ["manageCatalog"] },
  TICKET: { settings: ["edit"] },
};
export const catalogCategoriesRoutes: FastifyPluginAsync = (app) => {
  const authorize = async (
    req: FastifyRequest,
    scope: CategoryScope,
    write = false
  ) => {
    await requirePermission((write ? edit : view)[scope])(req, {} as never);
  };
  app.get("/", async (req) => {
    const { scope } = parseInput(
      z.object({ scope: z.enum(categoryScopes) }),
      req.query
    );
    await authorize(req, scope);
    return {
      data: await app.prisma.catalogCategory.findMany({
        where: { scope },
        orderBy: { name: "asc" },
      }),
    };
  });
  app.post("/", async (req, reply) => {
    const data = parseInput(
      categoryFields.extend({ scope: z.enum(categoryScopes) }),
      req.body
    );
    await authorize(req, data.scope, true);
    const { scope, ...fields } = data;
    return reply
      .status(201)
      .send({ data: await saveCategory(app.prisma, scope, fields) });
  });
  app.patch("/:id", async (req) => {
    const { id } = req.params as { id: string };
    const data = parseInput(
      categoryFields.extend({ scope: z.enum(categoryScopes) }),
      req.body
    );
    await authorize(req, data.scope, true);
    const { scope, ...fields } = data;
    return { data: await saveCategory(app.prisma, scope, fields, id) };
  });
  return Promise.resolve();
};
