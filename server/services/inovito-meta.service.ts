import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const SHA256_SIGNATURE = /^sha256=([a-f0-9]{64})$/i;
const SUBSCRIPTION_CHALLENGE = /^[A-Za-z0-9_-]{1,200}$/;

export interface IncomingMetaText {
  channel: "WHATSAPP" | "MESSENGER";
  correspondent: string;
  externalId: string;
  text: string;
}

/** Verify Meta's HMAC over the original, exact raw bytes. */
export function verifyMetaSignature(
  rawBody: Buffer,
  signature: unknown,
  appSecret: string
): boolean {
  if (typeof signature !== "string" || !appSecret) {
    return false;
  }
  const match = SHA256_SIGNATURE.exec(signature);
  if (!match) {
    return false;
  }
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  const actual = Buffer.from(match[1], "hex");
  return (
    expected.length === actual.length && timingSafeEqual(expected, actual)
  );
}

export function verifyMetaChallenge(
  input: unknown,
  expectedToken: string
): string | null {
  if (typeof input !== "object" || input === null || !expectedToken) {
    return null;
  }
  const data = input as Record<string, unknown>;
  const challenge = data["hub.challenge"];
  const supplied = data["hub.verify_token"];
  if (
    data["hub.mode"] !== "subscribe" ||
    typeof challenge !== "string" ||
    !SUBSCRIPTION_CHALLENGE.test(challenge) ||
    typeof supplied !== "string"
  ) {
    return null;
  }
  const first = Buffer.from(supplied);
  const second = Buffer.from(expectedToken);
  if (first.length !== second.length || !timingSafeEqual(first, second)) {
    return null;
  }
  return challenge;
}

const whatsappEnvelope = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(z.object({
    changes: z.array(z.object({
      value: z.object({
        metadata: z.object({
          phone_number_id: z.string().optional(),
        }).optional(),
        messages: z.array(z.object({
          id: z.string().max(300),
          from: z.string().max(100),
          type: z.string(),
          text: z.object({ body: z.string() }).optional(),
        })).optional(),
      }),
    })).optional(),
  })).optional(),
});

const messengerEnvelope = z.object({
  object: z.literal("page"),
  entry: z.array(z.object({
    id: z.string().max(100),
    messaging: z.array(z.object({
      sender: z.object({ id: z.string().max(100) }).optional(),
      message: z.object({
        mid: z.string().max(300),
        text: z.string().optional(),
        is_echo: z.boolean().optional(),
      }).optional(),
    })).optional(),
  })).optional(),
});

function parseWhatsApp(
  body: unknown,
  whatsappPhoneId: string
): IncomingMetaText[] {
  const payload = whatsappEnvelope.safeParse(body);
  if (!payload.success || !whatsappPhoneId) {
    return [];
  }
  const results: IncomingMetaText[] = [];
  for (const entry of payload.data.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.value.metadata?.phone_number_id !== whatsappPhoneId) {
        continue;
      }
      for (const message of change.value.messages ?? []) {
        const text = message.text?.body.trim();
        if (
          message.type !== "text" ||
          !text ||
          !message.id ||
          !message.from ||
          text.length > 4000
        ) {
          continue;
        }
        results.push({
          channel: "WHATSAPP",
          correspondent: message.from,
          externalId: [whatsappPhoneId, message.id].join(":").slice(0, 450),
          text,
        });
      }
    }
  }
  return results;
}

function parseMessenger(
  body: unknown,
  messengerPageId: string
): IncomingMetaText[] {
  const payload = messengerEnvelope.safeParse(body);
  if (!payload.success || !messengerPageId) {
    return [];
  }
  const results: IncomingMetaText[] = [];
  for (const entry of payload.data.entry ?? []) {
    if (entry.id !== messengerPageId) {
      continue;
    }
    for (const item of entry.messaging ?? []) {
      const message = item.message;
      const text = message?.text?.trim();
      if (
        !(message && text) ||
        message.is_echo ||
        !item.sender?.id ||
        text.length > 4000
      ) {
        continue;
      }
      results.push({
        channel: "MESSENGER",
        correspondent: item.sender.id,
        externalId: [messengerPageId, message.mid].join(":").slice(0, 450),
        text,
      });
    }
  }
  return results;
}

/** Only inbound text from configured business accounts; capped per delivery. */
export function extractIncomingMetaText(
  body: unknown,
  whatsappPhoneId: string,
  messengerPageId: string
): IncomingMetaText[] {
  return [
    ...parseWhatsApp(body, whatsappPhoneId),
    ...parseMessenger(body, messengerPageId),
  ].slice(0, 50);
}
