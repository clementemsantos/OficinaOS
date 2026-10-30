import { createHmac } from "node:crypto";
import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { inovitoMetaWebhookRoutes } from "../routes/inovito-meta-webhook";

const ORIGINAL_ENV = {
  webhook: process.env.INOVITO_META_WEBHOOK_ENABLED,
  capture: process.env.INOVITO_META_CAPTURE_ENABLED,
  secret: process.env.INOVITO_META_APP_SECRET,
  token: process.env.INOVITO_META_VERIFY_TOKEN,
};

afterEach(() => {
  const values = {
    INOVITO_META_WEBHOOK_ENABLED: ORIGINAL_ENV.webhook,
    INOVITO_META_CAPTURE_ENABLED: ORIGINAL_ENV.capture,
    INOVITO_META_APP_SECRET: ORIGINAL_ENV.secret,
    INOVITO_META_VERIFY_TOKEN: ORIGINAL_ENV.token,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

async function metaTestApp() {
  const app = Fastify();
  await app.register(inovitoMetaWebhookRoutes, {
    prefix: "/api/public/inovito-meta",
  });
  return app;
}

describe("Inovito webhook Meta — protocolo HTTP", () => {
  it("mantém o endpoint fechado quando não está configurado", async () => {
    delete process.env.INOVITO_META_WEBHOOK_ENABLED;
    const app = await metaTestApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/public/inovito-meta/webhook?hub.mode=subscribe&hub.verify_token=x&hub.challenge=1",
      });
      expect(response.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("exige assinatura válida antes de analisar JSON", async () => {
    process.env.INOVITO_META_WEBHOOK_ENABLED = "true";
    process.env.INOVITO_META_APP_SECRET = "meta-test-secret";
    process.env.INOVITO_META_CAPTURE_ENABLED = "false";
    const app = await metaTestApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/public/inovito-meta/webhook",
        headers: { "content-type": "application/json" },
        payload: '{"object":"page","entry":[]}',
      });
      expect(response.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("aceita evento assinado em dry-run sem acesso à base de dados", async () => {
    process.env.INOVITO_META_WEBHOOK_ENABLED = "true";
    process.env.INOVITO_META_APP_SECRET = "meta-test-secret";
    process.env.INOVITO_META_CAPTURE_ENABLED = "false";
    const body = '{"object":"page","entry":[]}';
    const signature = createHmac(
      "sha256",
      process.env.INOVITO_META_APP_SECRET
    ).update(body).digest("hex");
    const app = await metaTestApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/public/inovito-meta/webhook",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": `sha256=${signature}`,
        },
        payload: body,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ accepted: true, stored: 0 });
    } finally {
      await app.close();
    }
  });
});
