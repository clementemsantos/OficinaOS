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

/** Accept only inbound text for the configured business number/page. */
export function extractIncomingMetaText(
  body: unknown,
  whatsappPhoneId: string,
  messengerPageId: string
): IncomingMetaText[] {
  const messages: IncomingMetaText[] = [];
  const whatsapp = whatsappEnvelope.safeParse(body);
  if (whatsapp.success && whatsappPhoneId) {
    for (const entry of whatsapp.data.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.value.metadata?.phone_number_id !== whatsappPhoneId) {
          continue;
        }
        for (const message of change.value.messages ?? []) {
          const value = message.text?.body.trim();
          if (
            message.type !== "text" ||
            !value ||
            !message.id ||
            !message.from ||
            value.length > 4000
          ) {
            continue;
          }
          messages.push({
            channel: "WHATSAPP",
            correspondent: message.from,
            externalId: [whatsappPhoneId, message.id].join(":").slice(0, 450),
            text: value,
          });
        }
      }
    }
  }
  const messenger = messengerEnvelope.safeParse(body);
  if (messenger.success && messengerPageId) {
    for (const entry of messenger.data.entry ?? []) {
      if (entry.id !== messengerPageId) {
        continue;
      }
      for (const item of entry.messaging ?? []) {
        const msg = item.message;
        const value = msg?.text?.trim();
        if (!msg || !value || msg.is_echo || !item.sender?.id || value.length > 4000) {
          continue;
        }
        messages.push({
          channel: "MESSENGER",
          correspondent: item.sender.id,
          externalId: [messengerPageId, msg.mid].join(":").slice(0, 450),
          text: value,
        });
      }
    }
  }
  return messages.slice(0, 50);
}
