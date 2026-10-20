import { AppError } from "@shared/errors/app-error.js";
import {
  emailSettings,
  integrationKind,
  wooSettings,
} from "@shared/schemas/integrations";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { encryptSecret } from "../lib/crypto.js";
import { requirePermission } from "../middlewares/rbac.js";
import { syncIntegration } from "../services/integrations.service.js";
import { parseInput } from "../utils/parse-input.js";
import { getUserId } from "../utils/request.js";

export const integrationsRoutes: FastifyPluginAsync = (app) => {
  app.addHook(
    "preHandler",
    requirePermission({
      settings: ["edit"],
      parts: ["manageCatalog", "viewCost"],
    })
  );
  app.get("/", async () => ({
    automaticAvailable:
      process.env.OFICINAOS_SANDBOX !== "true" ||
      process.env.OFICINAOS_ENABLE_INTEGRATION_POLLING === "true",
    data: await app.prisma.integrationConnection.findMany({
      select: { kind: true, enabled: true, lastSyncAt: true, lastError: true },
    }),
  }));
  app.put("/:kind", async (req) => {
    const { kind } = parseInput(
      z.object({ kind: integrationKind }),
      req.params
    );
    const { settings, enabled } = parseInput(
      z.object({ settings: z.unknown(), enabled: z.boolean() }),
      req.body
    );
    const parsed =
      kind === "WOOCOMMERCE"
        ? parseInput(wooSettings, settings)
        : parseInput(emailSettings, settings);
    await app.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT kind FROM integration_connections WHERE kind = ${kind} FOR UPDATE`;
      const current = await tx.integrationConnection.findUnique({
        where: { kind },
      });
      if (current?.leaseUntil && current.leaseUntil > new Date()) {
        throw new AppError("CONFLICT");
      }
      const encrypted = encryptSecret(
        JSON.stringify({ ...parsed, userId: getUserId(req) })
      );
      await tx.integrationConnection.upsert({
        where: { kind },
        create: { kind, settings: encrypted, enabled },
        update: { settings: encrypted, enabled, cursor: null, lastError: null },
      });
    });
    return { saved: true };
  });
  app.patch("/:kind", async (req) => {
    const { kind } = parseInput(
      z.object({ kind: integrationKind }),
      req.params
    );
    const { enabled } = parseInput(
      z.object({ enabled: z.boolean() }),
      req.body
    );
    await app.prisma.integrationConnection.update({
      where: { kind },
      data: { enabled },
    });
    return { saved: true };
  });
  app.post("/:kind/sync", async (req) => {
    const { kind } = parseInput(
      z.object({ kind: integrationKind }),
      req.params
    );
    const socket = req.raw.socket;
    const previousTimeout = socket?.timeout ?? 60_000;
    socket?.setTimeout?.(10 * 60_000);
    try {
      return await syncIntegration(app.prisma, kind);
    } finally {
      socket?.setTimeout?.(previousTimeout);
    }
  });
  return Promise.resolve();
};
