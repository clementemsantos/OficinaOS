import { describe, expect, it } from "vitest";
import {
  configuredSites,
  normalizeSiteProducts,
  parseSiteOrigin,
} from "../services/inovito-sites.service";

describe("Inovito — sites permitidos no servidor", () => {
  it("começa pelo inove.pt e aceita outros domínios válidos futuramente", () => {
    expect(configuredSites("").map((site) => site.origin)).toEqual([
      "https://inove.pt",
    ]);
    expect(
      configuredSites(
        "https://inove.pt,https://loja.exemplo.pt,https://inove.pt"
      ).map((site) => site.origin)
    ).toEqual(["https://inove.pt", "https://loja.exemplo.pt"]);
  });

  it("rejeita endereços internos, HTTP, credenciais e caminhos arbitrários", () => {
    const bad = [
      "http://inove.pt",
      "https://localhost",
      "https://127.0.0.1",
      "https://192.168.0.4",
      "https://user:pass@inove.pt",
      "https://inove.pt/wp-admin",
      "https://inove.pt?api_key=secret",
      "https://inove.pt:8443",
      "https://server.internal",
    ];
    for (const input of bad) {
      expect(parseSiteOrigin(input)).toBeNull();
    }
  });

  it("limita a quantidade de sites por consulta", () => {
    const input = Array.from(
      { length: 12 },
      (_, i) => "https://site-" + i + ".exemplo.pt"
    ).join(",");
    expect(configuredSites(input)).toHaveLength(8);
  });
});

describe("Inovito — catálogo público WooCommerce", () => {
  it("apresenta preços em euros sem alterar nem criar produtos", () => {
    const data = normalizeSiteProducts(
      [{
        id: 4762,
        name: "Monitor HP",
        permalink: "https://inove.pt/produto/monitor-hp/",
        prices: {
          price: "18799",
          currency_code: "EUR",
          currency_minor_unit: 2,
        },
      }],
      "https://inove.pt"
    );
    expect(data).toHaveLength(1);
    expect(data[0].price).toContain("187,99");
    expect(data[0].price).toContain("€");
    expect(data[0].name).toBe("Monitor HP");
  });

  it("ignora ligações de produtos para outros domínios", () => {
    expect(
      normalizeSiteProducts(
        [{
          id: 1,
          name: "Produto",
          permalink: "https://outro-dominio.pt/produto/1",
        }],
        "https://inove.pt"
      )
    ).toEqual([]);
  });

  it("rejeita respostas e preços malformados", () => {
    expect(
      normalizeSiteProducts({ secret: "private" }, "https://inove.pt")
    ).toEqual([]);
    expect(
      normalizeSiteProducts(
        [{
          id: 17,
          name: "Produto",
          permalink: "https://inove.pt/produto/17",
          prices: {
            price: "not-a-number",
            currency_code: "EUR",
            currency_minor_unit: 2,
          },
        }],
        "https://inove.pt"
      )
    ).toEqual([]);
  });
});
