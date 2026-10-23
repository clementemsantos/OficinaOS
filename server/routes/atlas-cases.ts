import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requirePermission } from "../middlewares/rbac.js";
import { parseInput } from "../utils/parse-input.js";

// Shop records are evidence of recorded work, not proof that an issue was resolved.
export const atlasCasesRoutes: FastifyPluginAsync = (app) => {
  app.addHook("preHandler", requirePermission({ jobs: ["view"] }));
  app.get("/cases", async (req) => {
    const { q, cursor, completed } = parseInput(
      z.object({
        q: z.string().trim().max(100).optional(),
        cursor: z.string().optional(),
        completed: z.enum(["true", "false"]).optional(),
      }),
      req.query
    );
    const data = await app.prisma.job.findMany({
      where: {
        ...(completed === "true"
          ? { status: { in: ["DONE" as const, "DELIVERED" as const] } }
          : {}),
        ...(q
          ? {
              OR: [
                {
                  reportedProblem: {
                    contains: q,
                    mode: "insensitive" as const,
                  },
                },
                { jobCode: { contains: q, mode: "insensitive" as const } },
                {
                  device: {
                    model: { contains: q, mode: "insensitive" as const },
                  },
                },
                {
                  device: {
                    brand: {
                      name: { contains: q, mode: "insensitive" as const },
                    },
                  },
                },
                {
                  repairs: {
                    some: {
                      repairName: { contains: q, mode: "insensitive" as const },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        jobCode: true,
        reportedProblem: true,
        status: true,
        updatedAt: true,
        device: { select: { model: true, brand: { select: { name: true } } } },
        repairs: { select: { id: true, repairName: true } },
        partsUsed: {
          select: {
            id: true,
            partName: true,
            quantity: true,
            rmaQuantity: true,
          },
        },
      },
      orderBy: { id: "desc" },
      take: 50,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return { data, nextCursor: data.length === 50 ? data.at(-1)?.id : null };
  });
  return Promise.resolve();
};
