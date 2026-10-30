import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  extractIncomingMetaText,
  verifyMetaChallenge,
  verifyMetaSignature,
} from "../services/inovito-meta.service";

const secret = "meta-test-secret";
const raw = Buffer.from('{"object":"page","entry":[]}');

describe("Inovito — autenticação Meta", () => {
  it("aceita apenas HMAC correto dos bytes originais", () => {
    const digest = createHmac("sha256", secret).update(raw).digest("hex");
    expect(verifyMetaSignature(raw, ["sha256=", digest].join(""), secret)).toBe(
      true
    );
    expect(verifyMetaSignature(raw, "sha256=" + "a".repeat(64), secret)).toBe(
      false
    );
    expect(verifyMetaSignature(Buffer.from("{}"), ["sha256=", digest].join(""), secret)).toBe(false);
    expect(verifyMetaSignature(raw, undefined, secret)).toBe(false);
  });

  it("valida challenge com token constante e modo subscribe", () => {
    const input = {
      "hub.challenge": "123456",
      "hub.mode": "subscribe",
      "hub.verify_token": "token-secreto",
    };
    expect(verifyMetaChallenge(input, "token-secreto")).toBe("123456");
    expect(verifyMetaChallenge(input, "errado")).toBeNull();
    expect(verifyMetaChallenge({ ...input, "hub.mode": "remove" }, "token-secreto")).toBeNull();
  });
});

describe("Inovito — captura de mensagens Meta", () => {
  it("aceita WhatsApp recebido apenas para o número autorizado", () => {
    const event = {
      object: "whatsapp_business_account",
      entry: [{
        changes: [{
          value: {
            metadata: { phone_number_id: "wa-1" },
            messages: [
              { id: "wamid-123", from: "351900000000", type: "text", text: { body: "Olá" } },
              { id: "wamid-124", from: "351900000000", type: "image" },
            ],
          },
        }],
      }],
    };
    const messages = extractIncomingMetaText(event, "wa-1", "");
    expect(messages).toHaveLength(1);
    expect(messages[0].channel).toBe("WHATSAPP");
    expect(messages[0].text).toBe("Olá");
    expect(extractIncomingMetaText(event, "outro", "")).toHaveLength(0);
  });

  it("ignora eco e páginas não autorizadas do Messenger", () => {
    const event = {
      object: "page",
      entry: [{
        id: "page-1",
        messaging: [
          { sender: { id: "psid-1" }, message: { mid: "m-1", text: "Boa tarde" } },
          { sender: { id: "psid-1" }, message: { mid: "m-2", text: "eco", is_echo: true } },
        ],
      }],
    };
    expect(extractIncomingMetaText(event, "", "page-1")).toHaveLength(1);
    expect(extractIncomingMetaText(event, "", "page-2")).toHaveLength(0);
  });

  it("ignora payloads malformados sem devolver mensagens", () => {
    expect(extractIncomingMetaText(null, "wa", "page")).toEqual([]);
    expect(extractIncomingMetaText({}, "wa", "page")).toEqual([]);
  });
});
