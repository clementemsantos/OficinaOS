import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requirePermission } from "../middlewares/rbac.js";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  search: z.string().trim().max(100).optional(),
});

// This is the physical equipment inventory, separate from the Device
// brand/model catalog used by the repairs intake form.
// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const equipmentRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requirePermission({ jobs: ["view"] }));
  app.get("/", async (req, reply) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Consulta inválida." });
    }
    const { page, search } = parsed.data;
    const where = search
      ? {
          OR: [
            { brand: { contains: search, mode: "insensitive" as const } },
            { model: { contains: search, mode: "insensitive" as const } },
            { sourceId: { contains: search, mode: "insensitive" as const } },
            {
              serialNumber: { contains: search, mode: "insensitive" as const },
            },
          ],
        }
      : {};
    const [total, items] = await Promise.all([
      app.prisma.customerEquipment.count({ where }),
      app.prisma.customerEquipment.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * 30,
        take: 30,
        include: { customer: { select: { id: true, name: true } } },
      }),
    ]);
    return reply.send({ total, items, page, pageSize: 30 });
  });
};
