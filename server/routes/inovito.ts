import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";
import {
  createGoogleAuthorizeUrl,
  exchangeGoogleCode,
  fetchGoogleOverview,
  googleAccessToken,
  googleIsConfigured,
} from "../services/inovito-google.service.js";
import { readConfiguredSites } from "../services/inovito-sites.service.js";
import { decryptSecret, encryptSecret } from "../lib/crypto.js";
import {
  permittedWooOrigin,
  verifyWooReadAccess,
  wooPrivateConnectInput,
  wooPrivateEnabled,
} from "../services/inovito-woo-private.service.js";
import { parseInput } from "../utils/parse-input.js";
import { z } from "zod";
import { getSessionId, getUserId } from "../utils/request.js";

export const inovitoRoutes: FastifyPluginAsync = (app) => {
  // All routes (including callback) require an authenticated owner session.
  app.addHook("preHandler", requirePermission({ dashboard: ["viewOwner"] }));

  app.get("/connections", async (req, reply) => {
    reply.header("cache-control", "no-store");
    const [google, mail] = await Promise.all([
      app.prisma.inovitoGoogleConnection.findUnique({
        where: { userId: getUserId(req) },
        select: { connectedAt: true },
      }),
      app.prisma.integrationConnection.findUnique({
        where: { kind: "EMAIL" },
        select: { enabled: true, lastSyncAt: true, lastError: true },
      }),
    ]);
    return {
      google: {
        configured: googleIsConfigured(),
        connected: google !== null,
        connectedAt: google?.connectedAt ?? null,
      },
      mailImport: {
        enabled: mail?.enabled ?? false,
        lastSyncAt: mail?.lastSyncAt ?? null,
        hasError: Boolean(mail?.lastError),
      },
      whatsapp: {
        connected: false,
        setupRequired: true,
        webhookConfigured:
          process.env.INOVITO_META_WEBHOOK_ENABLED === "true" &&
          Boolean(process.env.INOVITO_META_APP_SECRET) &&
          Boolean(process.env.INOVITO_META_WA_PHONE_NUMBER_ID),
        captureEnabled: process.env.INOVITO_META_CAPTURE_ENABLED === "true",
      },
      messenger: {
        connected: false,
        setupRequired: true,
        webhookConfigured:
          process.env.INOVITO_META_WEBHOOK_ENABLED === "true" &&
          Boolean(process.env.INOVITO_META_APP_SECRET) &&
          Boolean(process.env.INOVITO_META_PAGE_ID),
        captureEnabled: process.env.INOVITO_META_CAPTURE_ENABLED === "true",
      },
    };
  });

  // The first site is inove.pt. Additional sites are trusted server config,
  // never a free-form user URL. Public published products only; no writes.
  app.get("/sites", async (_req, reply) => {
    reply.header("cache-control", "private, no-store");
    const [sites, woocommerce, privateConnections] = await Promise.all([
      readConfiguredSites(),
      app.prisma.integrationConnection.findUnique({
        where: { kind: "WOOCOMMERCE" },
        select: {
          enabled: true,
          lastSyncAt: true,
          lastError: true,
        },
      }),
      app.prisma.inovitoWooConnection.findMany({
        select: { origin: true },
      }),
    ]);
    return {
      sites,
      privateWoo: {
        enabled: wooPrivateEnabled(),
        connectedOrigins: privateConnections.map((item) => item.origin),
      },
      orderImport: {
        configured: Boolean(woocommerce),
        enabled: woocommerce?.enabled ?? false,
        lastSyncAt: woocommerce?.lastSyncAt ?? null,
        hasError: Boolean(woocommerce?.lastError),
        note: "O importador de encomendas existente suporta uma única loja; os catálogos públicos podem ter vários sites.",
      },
    };
  });


  // Private WooCommerce is read-only; never calls syncWoo or mutates orders.
  // All these routes inherit the authenticated owner permission.
  app.post("/sites/private", async (req, reply) => {
    reply.header("cache-control", "no-store");
    if (!wooPrivateEnabled()) {
      return reply.code(409).send({ message: "Ligação privada desativada no servidor." });
    }
    const payload = parseInput(wooPrivateConnectInput, req.body);
    const origin = permittedWooOrigin(payload.origin);
    if (!origin) {
      return reply.code(400).send({ message: "O domínio não está autorizado." });
    }
    try {
      const preview = await verifyWooReadAccess(origin, payload);
      await app.prisma.inovitoWooConnection.upsert({
        where: { origin },
        create: {
          origin,
          credentials: encryptSecret(JSON.stringify({
            key: payload.key,
            secret: payload.secret,
          })),
        },
        update: {
          credentials: encryptSecret(JSON.stringify({
            key: payload.key,
            secret: payload.secret,
          })),
        },
      });
      return { connected: true, origin, verifiedOrders: preview.length };
    } catch {
      // Never log raw credentials or provider response.
      return reply.code(422).send({
        message: "A ligação WooCommerce falhou. Confirma as permissões de leitura e as chaves.",
      });
    }
  });

  app.get("/sites/private/:host/preview", async (req, reply) => {
    reply.header("cache-control", "no-store");
    if (!wooPrivateEnabled()) {
      return reply.code(409).send({ message: "Ligação privada desativada." });
    }
    const { host } = parseInput(
      z.object({ host: z.string().max(253) }),
      req.params
    );
    const origin = permittedWooOrigin(`https://${host}`);
    if (!origin) {
      return reply.code(404).send({ message: "Site não autorizado." });
    }
    const connection = await app.prisma.inovitoWooConnection.findUnique({
      where: { origin },
    });
    if (!connection) {
      return reply.code(404).send({ message: "Site sem ligação privada." });
    }
    try {
      const credentials = JSON.parse(decryptSecret(connection.credentials));
      const data = await verifyWooReadAccess(origin, credentials);
      return { origin, data };
    } catch {
      return reply.code(503).send({
        message: "Não foi possível ler as encomendas. Verifica a ligação.",
      });
    }
  });

  app.delete("/sites/private/:host", async (req, reply) => {
    reply.header("cache-control", "no-store");
    const { host } = parseInput(
      z.object({ host: z.string().max(253) }),
      req.params
    );
    const origin = permittedWooOrigin(`https://${host}`);
    if (!origin) {
      return reply.code(404).send({ message: "Site não autorizado." });
    }
    await app.prisma.inovitoWooConnection.deleteMany({ where: { origin } });
    return { disconnected: true };
  });

  app.get("/google/connect", (req, reply) => {
    reply.header("cache-control", "no-store");
    const url = createGoogleAuthorizeUrl(getUserId(req), getSessionId(req));
    if (!url) {
      return reply
        .code(409)
        .send({ message: "Integração Google não configurada no servidor." });
    }
    return { url };
  });

  app.get("/google/callback", async (req, reply) => {
    reply.header("cache-control", "no-store");
    const params = req.query as Record<string, unknown>;
    if (
      params.error ||
      typeof params.state !== "string" ||
      typeof params.code !== "string"
    ) {
      return reply.redirect("/inovito?google=error");
    }
    try {
      const result = await exchangeGoogleCode(
        params.code,
        params.state,
        getUserId(req),
        getSessionId(req)
      );
      await app.prisma.inovitoGoogleConnection.upsert({
        where: { userId: getUserId(req) },
        create: {
          userId: getUserId(req),
          credentials: result.credentials,
          scopes: result.scopes,
        },
        update: {
          credentials: result.credentials,
          scopes: result.scopes,
        },
      });
      return reply.redirect("/inovito?google=connected");
    } catch (error) {
      req.log.warn({ err: error }, "Inovito: Google OAuth callback rejected");
      return reply.redirect("/inovito?google=error");
    }
  });

  app.get("/google/overview", async (req, reply) => {
    reply.header("cache-control", "no-store");
    const userId = getUserId(req);
    const connection = await app.prisma.inovitoGoogleConnection.findUnique({
      where: { userId },
    });
    if (!connection) {
      return reply.code(409).send({ message: "Google não está ligado." });
    }
    try {
      const token = await googleAccessToken(connection.credentials);
      if (token.updatedCredentials) {
        await app.prisma.inovitoGoogleConnection.update({
          where: { userId },
          data: { credentials: token.updatedCredentials },
        });
      }
      const overview = await fetchGoogleOverview(token.accessToken);
      return { data: overview };
    } catch (error) {
      req.log.warn({ err: error }, "Inovito: Google overview unavailable");
      return reply.code(503).send({
        message: "Não foi possível consultar o Google. Verifica a ligação.",
      });
    }
  });

  app.post("/google/disconnect", async (req) => {
    await app.prisma.inovitoGoogleConnection.deleteMany({
      where: { userId: getUserId(req) },
    });
    return { disconnected: true };
  });

  return Promise.resolve();
};
