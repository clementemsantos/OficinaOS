import { timingSafeEqual } from "node:crypto";
import { AppError } from "@shared/errors/app-error.js";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { loadEnv } from "../config/env.js";
import { requirePermission } from "../middlewares/rbac.js";
import { normalizeInovitoPhone } from "../utils/inovito-phone.js";

const callerSchema = z
  .object({
    callerPhone: z.string().min(1).max(40),
  })
  .strict();

const callEventSchema = callerSchema
  .extend({
    providerCallId: z
      .string()
      .min(4)
      .max(150)
      .regex(/^[a-zA-Z0-9:._-]+$/),
    calledPhone: z.string().max(40).optional(),
    status: z.enum(["ringing", "answered", "completed", "failed"]),
    durationSeconds: z.number().int().min(0).max(86_400).optional(),
    summary: z.string().max(2000).optional(),
  })
  .strict();

const exclusionSchema = z
  .object({
    phone: z.string().min(4).max(40),
  })
  .strict();

const customerAssociationSchema = z
  .object({
    customerId: z.string().min(1).nullable(),
  })
  .strict();

const statusRank = {
  ringing: 1,
  answered: 2,
  completed: 3,
  failed: 3,
} as const;

function equalsSecret(provided: unknown, expected: string): boolean {
  if (typeof provided !== "string") {
    return false;
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Gateway-only. Does not use a user session and must not expose secrets. */
// biome-ignore lint/suspicious/useAwait: Fastify async preHandler requires promise semantics, even without IO.
async function requireVoiceGateway(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const token = loadEnv().INOVITO_VOICE_TOKEN;
  if (!token) {
    reply.code(503).send({ code: "INOVITO_VOICE_DISABLED" });
    return;
  }
  if (!equalsSecret(request.headers["x-inovito-voice-token"], token)) {
    reply.code(401).send({ code: "UNAUTHORIZED" });
  }
}

/**
 * Gateway contract: /gateway/decision MUST be called before sending audio
 * to an AI provider. This does not perform reencaminhamento from the SIM.
 */
// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const inovitoVoiceRoutes: FastifyPluginAsync = async (app) => {
  app.post("/gateway/decision", {
    config: { public: true },
    preHandler: [requireVoiceGateway],
    schema: { tags: ["inovito-voice"], summary: "Gateway pre-answer decision" },
    handler: async (request, reply) => {
      const parsed = callerSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR");
      }
      const phone = normalizeInovitoPhone(parsed.data.callerPhone);
      if (!phone) {
        return reply.send({ allowAI: false, reason: "unidentified" });
      }
      const excluded = await app.prisma.inovitoExcludedNumber.findUnique({
        where: { phone },
        select: { id: true },
      });
      return reply.send({
        allowAI: !excluded,
        reason: excluded ? "excluded" : "allowed",
      });
    },
  });

  // No inbound event from a private/blocked number reaches the commercial log.
  app.post("/gateway/event", {
    config: { public: true },
    preHandler: [requireVoiceGateway],
    schema: { tags: ["inovito-voice"], summary: "Idempotent voice event" },
    handler: async (request, reply) => {
      const parsed = callEventSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR");
      }
      const event = parsed.data;
      const callerPhone = normalizeInovitoPhone(event.callerPhone);
      if (!callerPhone) {
        return reply.send({ ignored: true, reason: "unidentified" });
      }
      const excluded = await app.prisma.inovitoExcludedNumber.findUnique({
        where: { phone: callerPhone },
        select: { id: true },
      });
      if (excluded) {
        return reply.send({ ignored: true, reason: "excluded" });
      }

      const calledPhone = event.calledPhone
        ? normalizeInovitoPhone(event.calledPhone)
        : null;
      const rank = statusRank[event.status];
      const completedAt =
        event.status === "completed" || event.status === "failed"
          ? new Date()
          : null;
      // Uniqueness on providerCallId prevents duplicate rows on webhook retry.
      const current = await app.prisma.inovitoCall.upsert({
        where: { providerCallId: event.providerCallId },
        create: {
          providerCallId: event.providerCallId,
          callerPhone,
          calledPhone,
          status: event.status,
          eventRank: rank,
          durationSeconds: event.durationSeconds,
          summary: event.summary,
          completedAt,
        },
        update: {},
        select: { id: true, callerPhone: true },
      });
      if (current.callerPhone !== callerPhone) {
        return reply.code(409).send({ code: "CALL_ID_COLLISION" });
      }
      // Never roll a completed call back to ringing due to event reordering.
      await app.prisma.inovitoCall.updateMany({
        where: {
          providerCallId: event.providerCallId,
          eventRank: { lte: rank },
        },
        data: {
          status: event.status,
          eventRank: rank,
          ...(event.durationSeconds === undefined
            ? {}
            : { durationSeconds: event.durationSeconds }),
          ...(event.summary === undefined ? {} : { summary: event.summary }),
          ...(completedAt ? { completedAt } : {}),
        },
      });
      return reply.send({ ok: true, id: current.id });
    },
  });

  app.get("/calls", {
    preHandler: [requirePermission({ customers: ["view"] })],
    schema: { tags: ["inovito-voice"], summary: "List commercial voice calls" },
    handler: async (_request, reply) => {
      const calls = await app.prisma.inovitoCall.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { customer: { select: { id: true, name: true } } },
      });
      return reply.send({ calls });
    },
  });

  app.patch("/calls/:id/customer", {
    preHandler: [requirePermission({ customers: ["edit"] })],
    schema: {
      tags: ["inovito-voice"],
      summary: "Link a verified customer to a call",
    },
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = customerAssociationSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR");
      }
      if (parsed.data.customerId) {
        const customer = await app.prisma.customer.findUnique({
          where: { id: parsed.data.customerId },
          select: { id: true },
        });
        if (!customer) {
          return reply.code(404).send({ code: "CUSTOMER_NOT_FOUND" });
        }
      }
      const updated = await app.prisma.inovitoCall.updateMany({
        where: { id },
        data: { customerId: parsed.data.customerId },
      });
      if (!updated.count) {
        return reply.code(404).send({ code: "CALL_NOT_FOUND" });
      }
      return reply.send({ ok: true });
    },
  });

  app.get("/exclusions", {
    preHandler: [requirePermission({ settings: ["view"] })],
    schema: {
      tags: ["inovito-voice"],
      summary: "List numbers excluded from AI",
    },
    handler: async (_request, reply) => {
      const numbers = await app.prisma.inovitoExcludedNumber.findMany({
        orderBy: { createdAt: "desc" },
      });
      return reply.send({ numbers });
    },
  });

  app.post("/exclusions", {
    preHandler: [requirePermission({ settings: ["edit"] })],
    schema: {
      tags: ["inovito-voice"],
      summary: "Exclude a number from voice AI",
    },
    handler: async (request, reply) => {
      const parsed = exclusionSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR");
      }
      const phone = normalizeInovitoPhone(parsed.data.phone);
      if (!phone) {
        throw new AppError("VALIDATION_ERROR");
      }
      // When a number is marked personal, purge any earlier commercial
      // call records for it so private history is not retained by mistake.
      const exclusion = await app.prisma.$transaction(async (tx) => {
        const entry = await tx.inovitoExcludedNumber.upsert({
          where: { phone },
          create: { phone },
          update: {},
        });
        await tx.inovitoCall.deleteMany({ where: { callerPhone: phone } });
        return entry;
      });
      return reply.send(exclusion);
    },
  });

  app.delete("/exclusions/:id", {
    preHandler: [requirePermission({ settings: ["edit"] })],
    schema: { tags: ["inovito-voice"], summary: "Remove number exclusion" },
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const removed = await app.prisma.inovitoExcludedNumber.deleteMany({
        where: { id },
      });
      return reply.send({ removed: removed.count });
    },
  });
};
