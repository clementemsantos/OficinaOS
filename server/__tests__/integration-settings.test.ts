import { isAppError } from "@shared/errors/app-error.js";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { matchRoute, routeSecurity } from "../config/route-security.js";
import { decryptSecret } from "../lib/crypto.js";
import { integrationsRoutes } from "../routes/integrations.js";

vi.mock("../services/integrations.service.js", () => ({
  syncIntegration: vi.fn(() => Promise.resolve({ imported: 1 })),
}));
function build(allowed = true, busy = false) {
  const prisma = {
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(),
    integrationConnection: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () =>
        busy ? { leaseUntil: new Date(Date.now() + 60_000) } : null
      ),
      upsert: vi.fn(async (_input: unknown) => ({})),
    },
  };
  prisma.$transaction.mockImplementation((run) => run(prisma));
  const app = Fastify();
  app.decorate("prisma", prisma as never);
  app.decorate("auth", {
    api: { userHasPermission: () => Promise.resolve({ success: allowed }) },
  } as never);
  app.addHook("onRequest", (req, _reply, done) => {
    req.user = { id: "owner1", role: "OWNER" } as never;
    done();
  });
  app.setErrorHandler((error, _req, reply) => {
    reply
      .code(isAppError(error) ? error.status : 500)
      .send({ code: isAppError(error) ? error.code : "INTERNAL_ERROR" });
  });
  app.register(integrationsRoutes, { prefix: "/api/integrations" });
  return { app, prisma };
}
const payload = {
  enabled: false,
  settings: {
    url: "https://shop.example.invalid",
    key: "ck_private",
    secret: "cs_private",
    since: "2026-10-01T00:00:00Z",
  },
};
describe("integration credentials", () => {
  it("encrypts credentials at rest and returns only a save confirmation", async () => {
    const { app, prisma } = build();
    const response = await app.inject({
      method: "PUT",
      url: "/api/integrations/WOOCOMMERCE",
      payload,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ saved: true });
    const stored = prisma.integrationConnection.upsert.mock
      .calls[0]?.[0] as unknown as {
      create: { settings: string; enabled: boolean };
    };
    expect(stored.create.settings).not.toContain("cs_private");
    expect(stored.create.enabled).toBe(false);
    expect(JSON.parse(decryptSecret(stored.create.settings))).toMatchObject({
      ...payload.settings,
      userId: "owner1",
    });
    expect(
      matchRoute("/api/integrations/WOOCOMMERCE", routeSecurity)
        ?.allowSensitiveKeys
    ).toBe(true);
    expect(
      matchRoute("/api/integrations/WOOCOMMERCE", routeSecurity)?.csrf
    ).not.toBe(false);
    await app.close();
  });
  it("allows the manual sync route to finish with the extended timeout", async () => {
    const { app } = build();
    const response = await app.inject({
      method: "POST",
      url: "/api/integrations/EMAIL/sync",
      payload: {},
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ imported: 1 });
    await app.close();
  });
  it("denies non-administrative access and configuration replacement during sync", async () => {
    for (const [allowed, busy, status] of [
      [false, false, 403],
      [true, true, 409],
    ] as const) {
      const { app, prisma } = build(allowed, busy);
      const response = await app.inject({
        method: "PUT",
        url: "/api/integrations/WOOCOMMERCE",
        payload,
      });
      expect(response.statusCode).toBe(status);
      expect(prisma.integrationConnection.upsert).not.toHaveBeenCalled();
      await app.close();
    }
  });
});
