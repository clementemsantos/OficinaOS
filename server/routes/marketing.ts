import { Prisma } from "@generated/client";
import { AppError } from "@shared/errors/app-error.js";
import {
  campaignFields,
  campaignUpdate,
  leadFields,
  marketingQuery,
  marketingVersion,
} from "@shared/schemas/marketing";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requirePermission } from "../middlewares/rbac.js";
import { createAuditLog } from "../services/audit.service.js";
import { parseInput } from "../utils/parse-input.js";
import { getUserId } from "../utils/request.js";

const recordFields = z.object({ id: z.string().min(1).max(100) });
function nextVersion(version: string) {
  return new Date(Math.max(Date.now(), new Date(version).getTime() + 1));
}
export const marketingRoutes: FastifyPluginAsync = (app) => {
  app.addHook("preHandler", requirePermission({ settings: ["edit"] }));
  app.get("/campaigns", async (req) => {
    const { q, cursor } = parseInput(marketingQuery, req.query);
    const rows = await app.prisma.marketingCampaign.findMany({
      where: q ? { name: { contains: q, mode: "insensitive" } } : {},
      take: 101,
      orderBy: { id: "desc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const data = rows.slice(0, 100);
    const groups = await app.prisma.marketingLead.groupBy({
      by: ["campaignId", "stage"],
      where: { campaignId: { in: data.map((row) => row.id) } },
      _count: { _all: true },
      _sum: { value: true },
    });
    return {
      data: data.map((row) => {
        const own = groups.filter((group) => group.campaignId === row.id);
        const count = own.reduce((sum, group) => sum + group._count._all, 0);
        const won = own.find((group) => group.stage === "WON");
        const revenue = new Prisma.Decimal(won?._sum.value ?? 0);
        return {
          ...row,
          leadCount: count,
          wonCount: won?._count._all ?? 0,
          estimatedRevenue: revenue.toFixed(2),
          costPerLead: count ? row.spend.div(count).toFixed(2) : null,
          estimatedRoas: row.spend.greaterThan(0)
            ? revenue.div(row.spend).toFixed(2)
            : null,
        };
      }),
      nextCursor: rows.length > 100 ? data.at(-1)?.id : null,
    };
  });
  app.get("/leads", async (req) => {
    const { q, cursor, stage } = parseInput(
      marketingQuery.extend({ stage: leadFields.shape.stage.optional() }),
      req.query
    );
    const rows = await app.prisma.marketingLead.findMany({
      where: {
        stage,
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" as const } },
                {
                  customer: {
                    name: { contains: q, mode: "insensitive" as const },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        customer: { select: { id: true, name: true } },
        campaign: { select: { id: true, name: true } },
      },
      take: 101,
      orderBy: { id: "desc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return {
      data: rows.slice(0, 100),
      nextCursor: rows.length > 100 ? rows[99].id : null,
    };
  });
  app.post("/campaigns", async (req, reply) => {
    const data = parseInput(campaignFields, req.body);
    const result = await app.prisma.$transaction(async (tx) => {
      const row = await tx.marketingCampaign.create({ data });
      await createAuditLog(tx, {
        action: "API_MUTATION",
        jobId: null,
        userId: getUserId(req),
        metadata: {
          operation: "MARKETING_CAMPAIGN_CREATED",
          campaignId: row.id,
        },
      });
      return row;
    });
    return reply.code(201).send({ data: result });
  });
  app.patch("/campaigns/:id", async (req) => {
    const { id } = parseInput(recordFields, req.params);
    const { expectedUpdatedAt, ...data } = parseInput(campaignUpdate, req.body);
    await app.prisma.$transaction(async (tx) => {
      const changed = await tx.marketingCampaign.updateMany({
        where: { id, updatedAt: new Date(expectedUpdatedAt) },
        data: { ...data, updatedAt: nextVersion(expectedUpdatedAt) },
      });
      if (changed.count !== 1) {
        throw new AppError("CONFLICT");
      }
      await createAuditLog(tx, {
        action: "API_MUTATION",
        jobId: null,
        userId: getUserId(req),
        metadata: { operation: "MARKETING_CAMPAIGN_UPDATED", campaignId: id },
      });
    });
    return { saved: true };
  });
  async function validateLead(data: z.infer<typeof leadFields>) {
    const [customer, campaign] = await Promise.all([
      data.customerId
        ? app.prisma.customer.findUnique({
            where: { id: data.customerId },
            select: { id: true },
          })
        : true,
      data.campaignId
        ? app.prisma.marketingCampaign.findUnique({
            where: { id: data.campaignId },
            select: { id: true },
          })
        : true,
    ]);
    if (!(customer && campaign)) {
      throw new AppError("NOT_FOUND");
    }
  }
  app.post("/leads", async (req, reply) => {
    const data = parseInput(leadFields, req.body);
    await validateLead(data);
    const result = await app.prisma.$transaction(async (tx) => {
      const row = await tx.marketingLead.create({ data });
      await createAuditLog(tx, {
        action: "API_MUTATION",
        jobId: null,
        userId: getUserId(req),
        metadata: { operation: "CRM_LEAD_CREATED", leadId: row.id },
      });
      return row;
    });
    return reply.code(201).send({ data: result });
  });
  app.patch("/leads/:id", async (req) => {
    const { id } = parseInput(recordFields, req.params);
    const { expectedUpdatedAt, ...data } = parseInput(
      leadFields.extend(marketingVersion.shape),
      req.body
    );
    await validateLead(data);
    await app.prisma.$transaction(async (tx) => {
      const changed = await tx.marketingLead.updateMany({
        where: { id, updatedAt: new Date(expectedUpdatedAt) },
        data: { ...data, updatedAt: nextVersion(expectedUpdatedAt) },
      });
      if (changed.count !== 1) {
        throw new AppError("CONFLICT");
      }
      await createAuditLog(tx, {
        action: "API_MUTATION",
        jobId: null,
        userId: getUserId(req),
        metadata: { operation: "CRM_LEAD_UPDATED", leadId: id },
      });
    });
    return { saved: true };
  });
  return Promise.resolve();
};
