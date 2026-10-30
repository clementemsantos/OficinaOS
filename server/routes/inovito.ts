import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";
import { getSessionId, getUserId } from "../utils/request.js";
import {
  createGoogleAuthorizeUrl,
  exchangeGoogleCode,
  fetchGoogleOverview,
  googleAccessToken,
  googleIsConfigured,
} from "../services/inovito-google.service.js";

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
      whatsapp: { connected: false, setupRequired: true },
      messenger: { connected: false, setupRequired: true },
    };
  });

  app.get("/google/connect", async (req, reply) => {
    reply.header("cache-control", "no-store");
    const url = createGoogleAuthorizeUrl(getUserId(req), getSessionId(req));
    if (!url) {
      return reply.code(409).send({ message: "Integração Google não configurada no servidor." });
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
