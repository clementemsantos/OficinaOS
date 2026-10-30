import { describe, expect, it } from "vitest";
import {
  extractAiQuestion,
  formatPendingTasks,
  isPendingTasksRequest,
  readInovitoDraft,
} from "../inovito-intents";

describe("Inovito — tarefas por concluir", () => {
  it("identifica pedidos de contagem em pt-PT", () => {
    expect(isPendingTasksRequest("Quantas tarefas pendentes temos?")).toBe(
      true
    );
    expect(isPendingTasksRequest("Dá-me o total de tarefas")).toBe(true);
    expect(isPendingTasksRequest("Abre as tarefas")).toBe(false);
    expect(isPendingTasksRequest("Quantas reparações há?")).toBe(false);
  });

  it("não divulga nomes ou títulos nem inventa um total quando existem mais páginas", () => {
    const result = formatPendingTasks({
      data: [{ title: "Cliente confidencial" }],
      nextCursor: "cursor",
    });
    expect(result).toContain("pelo menos 1");
    expect(result).toContain("mais páginas");
    expect(result).not.toContain("Cliente confidencial");
    expect(result).not.toContain("cursor");
  });

  it("indica um total exato quando não existem mais páginas", () => {
    expect(formatPendingTasks({ data: [], nextCursor: null })).toContain(
      "Há 0 tarefas"
    );
  });
});

describe("Inovito — perguntas à IA sem envio automático", () => {
  it("reconhece pedido de pergunta", () => {
    expect(
      extractAiQuestion("Pergunta ao assistente como diagnosticar um iPhone")
    ).toBe("como diagnosticar um iphone");
    expect(extractAiQuestion("Abre os clientes")).toBeNull();
    expect(extractAiQuestion("Pergunta ao assistente")).toBeNull();
  });

  it("rejeita textos demasiado longos e valores inválidos no estado de navegação", () => {
    expect(extractAiQuestion(`pergunta a ia ${"x".repeat(501)}`)).toBeNull();
    expect(readInovitoDraft({ inovitoDraft: " Teste " })).toBe("Teste");
    expect(readInovitoDraft({ inovitoDraft: "x".repeat(501) })).toBeNull();
    expect(readInovitoDraft({ inovitoDraft: 17 })).toBeNull();
    expect(readInovitoDraft(null)).toBeNull();
  });
});
