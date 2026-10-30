import { describe, expect, it } from "vitest";
import {
  formatOwnerSummary,
  isOwnerSummaryRequest,
} from "../inovito-owner-summary";

describe("Inovito — resumo agregado da loja", () => {
  it("reconhece pedidos habituais em português de Portugal", () => {
    expect(isOwnerSummaryRequest("Dá-me um resumo da loja")).toBe(true);
    expect(isOwnerSummaryRequest("Qual é o estado da oficina?")).toBe(true);
    expect(isOwnerSummaryRequest("Quantas reparações temos abertas?")).toBe(
      true
    );
    expect(isOwnerSummaryRequest("Abre a ficha de cliente")).toBe(false);
  });

  it("responde apenas com os indicadores já consultados", () => {
    const result = formatOwnerSummary({
      activeJobs: 11,
      completedToday: 2,
      overdueJobs: [{ customerName: "Pessoa Confidencial" }] as never[],
      pickupReady: [{ customerPhone: "900000000" }] as never[],
    });
    expect(result).toContain("11 serviços ativos");
    expect(result).toContain("2 serviços");
    expect(result).toContain("1 reparação em atraso");
    expect(result).toContain("1 equipamento pronto");
    expect(result).not.toContain("Pessoa Confidencial");
    expect(result).not.toContain("900000000");
    expect(result).toContain("podem não incluir todos");
  });

  it("trata contagens zero sem inventar trabalho", () => {
    const result = formatOwnerSummary({
      activeJobs: 0,
      completedToday: 0,
      overdueJobs: [],
      pickupReady: [],
    });
    expect(result).toContain("0 serviços ativos");
    expect(result).toContain("0 serviços");
    expect(result).toContain("0 reparações em atraso");
  });
});
