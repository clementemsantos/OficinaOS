import { afterEach, describe, expect, it } from "vitest";
import {
  parseWooOrderPreviews,
  permittedWooOrigin,
  wooPrivateConnectInput,
  wooPrivateEnabled,
} from "../services/inovito-woo-private.service";

const previousEnv = {
  enabled: process.env.INOVITO_WOO_PRIVATE_ENABLED,
  origins: process.env.INOVITO_SITE_ORIGINS,
  sandbox: process.env.OFICINAOS_SANDBOX,
  demo: process.env.DEMO_MODE,
};

afterEach(() => {
  const next = {
    INOVITO_WOO_PRIVATE_ENABLED: previousEnv.enabled,
    INOVITO_SITE_ORIGINS: previousEnv.origins,
    OFICINAOS_SANDBOX: previousEnv.sandbox,
    DEMO_MODE: previousEnv.demo,
  };
  for (const [name, value] of Object.entries(next)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
});

describe("Inovito WooCommerce — permissão e domínio", () => {
  it("começa desligado e nunca permite captura em demo/sandbox", () => {
    delete process.env.INOVITO_WOO_PRIVATE_ENABLED;
    expect(wooPrivateEnabled()).toBe(false);
    process.env.INOVITO_WOO_PRIVATE_ENABLED = "true";
    process.env.OFICINAOS_SANDBOX = "true";
    expect(wooPrivateEnabled()).toBe(false);
    delete process.env.OFICINAOS_SANDBOX;
    process.env.DEMO_MODE = "true";
    expect(wooPrivateEnabled()).toBe(false);
  });

  it("aceita somente origem de site previamente aprovada", () => {
    process.env.INOVITO_SITE_ORIGINS =
      "https://inove.pt,https://loja.exemplo.pt";
    expect(permittedWooOrigin("https://inove.pt")).toBe("https://inove.pt");
    expect(permittedWooOrigin("https://loja.exemplo.pt/")).toBe(
      "https://loja.exemplo.pt"
    );
    expect(permittedWooOrigin("https://outro-site.pt")).toBeNull();
    expect(permittedWooOrigin("http://inove.pt")).toBeNull();
    expect(permittedWooOrigin("https://localhost")).toBeNull();
    expect(permittedWooOrigin("https://inove.pt/admin")).toBeNull();
  });

  it("limita o formato das credenciais sem as divulgar", () => {
    expect(
      wooPrivateConnectInput.safeParse({
        origin: "https://inove.pt",
        key: "ck_test_reader",
        secret: "cs_test_reader",
      }).success
    ).toBe(true);
    expect(
      wooPrivateConnectInput.safeParse({
        origin: "https://inove.pt",
        key: "x",
        secret: "",
      }).success
    ).toBe(false);
  });
});

describe("Inovito WooCommerce — pré-visualização", () => {
  it("devolve apenas os campos essenciais e nunca dados do cliente", () => {
    const preview = parseWooOrderPreviews([{
      id: 25,
      number: "25",
      status: "processing",
      total: "49.99",
      currency: "EUR",
      date_modified_gmt: "2026-10-01T13:30:00",
      billing: {
        email: "privado@example.com",
        phone: "900000000",
        first_name: "Pessoa confidencial",
      },
      line_items: [{ name: "Produto secreto" }],
    }]);
    expect(preview).toHaveLength(1);
    expect(preview[0].total).toContain("49,99");
    expect(JSON.stringify(preview)).not.toContain("privado@example.com");
    expect(JSON.stringify(preview)).not.toContain("900000000");
    expect(JSON.stringify(preview)).not.toContain("Produto secreto");
  });

  it("rejeita respostas malformadas sem apresentar dados brutos", () => {
    expect(parseWooOrderPreviews({ error: "credenciais" })).toEqual([]);
    expect(
      parseWooOrderPreviews([{
        id: 1,
        number: "1",
        status: "processing",
        total: "NaN",
        currency: "EUR",
      }])
    ).toEqual([]);
  });
});
