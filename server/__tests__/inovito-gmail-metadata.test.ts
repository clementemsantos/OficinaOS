import { describe, expect, it } from "vitest";
import { formatGmailHeaders } from "../services/inovito-google.service";

describe("Inovito — pré-visualização de Gmail sem conteúdo de mensagens", () => {
  it("extrai apenas assunto/remetente e não expõe corpo ou anexos", () => {
    const result = formatGmailHeaders({
      id: "18ab02ff",
      payload: {
        headers: [
          { name: "Subject", value: "Orçamento - cliente" },
          { name: "From", value: "Pessoa <pessoa@example.com>" },
          { name: "X-Secret", value: "não divulgar" },
        ],
      },
    });
    expect(result).toEqual({
      id: "18ab02ff",
      from: "Pessoa <pessoa@example.com>",
      subject: "Orçamento - cliente",
    });
    expect(JSON.stringify(result)).not.toContain("não divulgar");
  });

  it("limita comprimento e remove quebras de linha de cabeçalhos", () => {
    const result = formatGmailHeaders({
      id: "a8",
      payload: {
        headers: [
          { name: "subject", value: "Texto\r\n" + "A".repeat(250) },
          { name: "FROM", value: "Remetente\nOutra linha" },
        ],
      },
    });
    expect(result?.subject).toContain("Texto  ");
    expect(result?.subject.length).toBeLessThanOrEqual(160);
    expect(result?.from).not.toContain("\n");
  });

  it("rejeita identificadores que não sejam IDs do Gmail", () => {
    expect(formatGmailHeaders({ id: "../../tokens" })).toBeNull();
    expect(formatGmailHeaders({ id: "" })).toBeNull();
    expect(formatGmailHeaders({ id: "d".repeat(101) })).toBeNull();
  });
});
