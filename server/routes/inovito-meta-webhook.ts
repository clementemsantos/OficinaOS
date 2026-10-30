import type { FastifyPluginAsync } from "fastify";
import {
  extractIncomingMetaText,
  verifyMetaChallenge,
  verifyMetaSignature,
} from "../services/inovito-meta.service.js";

const MAX_PAYLOAD_BYTES = 256 * 1024;

/**
 * Meta webhooks have no user session. Everything is disabled until the server
 * operator explicitly sets the required secrets and capture switch.
 * This plugin is registered only under /api/public/inovito-meta.
 */
export const inovitoMetaWebhookRoutes: FastifyPluginAsync = (app) => {
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer", bodyLimit: MAX_PAYLOAD_BYTES },
    (_req, body, done) => done(null, body)
  );

  app.get("/webhook", (req, reply) => {
    reply.header("cache-control", "no-store");
    const enabled = process.env.INOVITO_META_WEBHOOK_ENABLED === "true";
    const token = process.env.INOVITO_META_VERIFY_TOKEN ?? "";
    if (!(enabled && token)) {
      return reply.code(404).send("Not found");
    }
    const challenge = verifyMetaChallenge(req.query, token);
    if (!challenge) {
      return reply.code(403).send("Forbidden");
    }
    return reply.type("text/plain").send(challenge);
  });

  app.post("/webhook", async (req, reply) => {
    reply.header("cache-control", "no-store");
    const enabled = process.env.INOVITO_META_WEBHOOK_ENABLED === "true";
    const secret = process.env.INOVITO_META_APP_SECRET ?? "";
    const raw = req.body;
    if (!(enabled && secret)) {
      return reply.code(404).send({ error: "Not enabled" });
    }
    if (
      !(
        Buffer.isBuffer(raw) &&
        verifyMetaSignature(raw, req.headers["x-hub-signature-256"], secret)
      )
    ) {
      return reply.code(401).send({ error: "Invalid signature" });
    }
    let payload: unknown;
    try {
      payload = JSON.parse(raw.toString("utf8"));
    } catch {
      return reply.code(400).send({ error: "Invalid JSON" });
    }
    // Safe dry-run by default. No message is saved until explicit opt-in.
    if (
      process.env.INOVITO_META_CAPTURE_ENABLED !== "true" ||
      process.env.OFICINAOS_SANDBOX === "true" ||
      process.env.DEMO_MODE === "true"
    ) {
      return { accepted: true, stored: 0 };
    }
    const whatsappPhoneId = process.env.INOVITO_META_WA_PHONE_NUMBER_ID ?? "";
    const messengerPageId = process.env.INOVITO_META_PAGE_ID ?? "";
    const incoming = extractIncomingMetaText(
      payload,
      whatsappPhoneId,
      messengerPageId
    );
    if (incoming.length === 0) {
      return { accepted: true, stored: 0 };
    }
    const owner = await app.prisma.user.findFirst({
      where: { role: "OWNER", isActive: true },
      select: { id: true },
    });
    if (!owner) {
      req.log.error("Inovito Meta webhook: active owner not configured");
      return reply.code(503).send({ error: "No owner available" });
    }
    const result = await app.prisma.businessMessage.createMany({
      data: incoming.map((msg) => ({
        channel: msg.channel,
        direction: "INBOUND",
        deliveryStatus: "CAPTURED",
        subject: msg.channel === "WHATSAPP" ? "WhatsApp recebido" : "Messenger recebido",
        body: msg.text,
        correspondent: msg.correspondent,
        externalId: msg.externalId,
        createdById: owner.id,
      })),
      skipDuplicates: true,
    });
    return { accepted: true, stored: result.count };
  });

  return Promise.resolve();
};
