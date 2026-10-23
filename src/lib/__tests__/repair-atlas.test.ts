import { describe, expect, it } from "vitest";
import {
  ATLAS_GUIDES,
  categoryForDevice,
  normalizeAtlasSearch,
  searchAtlasGuides,
} from "../repair-atlas";

describe("Atlas de Reparações", () => {
  it("garante slugs únicos e guias com pontos de segurança", () => {
    expect(new Set(ATLAS_GUIDES.map((g) => g.id)).size).toBe(
      ATLAS_GUIDES.length
    );
    for (const guide of ATLAS_GUIDES) {
      expect(guide.precautions.length).toBeGreaterThan(0);
      expect(guide.checkpoints.length).toBeGreaterThan(0);
      expect(guide.validation.length).toBeGreaterThan(0);
      expect(guide.flow.length).toBeGreaterThan(1);
    }
  });

  it("pesquisa com e sem acentos", () => {
    expect(normalizeAtlasSearch("Oxidação e Ecrã")).toBe("oxidacao e ecra");
    expect(
      searchAtlasGuides("oxidacao").some(
        (g) => g.id === "equipamento-com-liquidos"
      )
    ).toBe(true);
  });

  it("encontra sintomas frequentes, incluindo não liga", () => {
    expect(
      searchAtlasGuides("não liga").some((g) => g.id === "telemovel-nao-liga")
    ).toBe(true);
    expect(
      searchAtlasGuides("não carrega").some(
        (g) => g.id === "telemovel-nao-carrega"
      )
    ).toBe(true);
  });

  it("filtra categorias para a ficha de reparação", () => {
    const guides = searchAtlasGuides("sem imagem", "laptop");
    expect(guides.length).toBeGreaterThan(0);
    expect(guides.every((g) => g.category === "laptop")).toBe(true);
    expect(categoryForDevice("console")).toBe("console");
    expect(categoryForDevice("unknown")).toBe("all");
  });

  it("não apresenta resultados sem correspondência", () => {
    expect(searchAtlasGuides("xyznaoencontrado123")).toEqual([]);
  });
});
