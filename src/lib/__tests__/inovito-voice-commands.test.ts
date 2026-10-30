import { describe, expect, it } from "vitest";
import {
  isVoiceHelpRequest,
  matchVoiceDestination,
  normalizeVoice,
  parseVoiceInput,
} from "../inovito-voice-commands";

describe("Inovito voz — privacidade e navegação", () => {
  it("ignora conversas sem a palavra de ativação", () => {
    expect(parseVoiceInput("Abre os clientes")).toEqual({ kind: "ignore" });
  });

  it("ativa-se com 'Inovito' e aguarda comando", () => {
    expect(parseVoiceInput("Inovito")).toEqual({ kind: "wake" });
    expect(parseVoiceInput("Mostra as tarefas", true)).toEqual({
      kind: "command",
      text: "mostra as tarefas",
    });
  });

  it("aceita uma ordem na mesma frase", () => {
    expect(parseVoiceInput("Olá Inovito, abre as encomendas")).toEqual({
      kind: "command",
      text: "abre as encomendas",
    });
  });

  it("normaliza o português de Portugal", () => {
    expect(normalizeVoice("  REPARAÇÕES! ")).toBe("reparacoes");
    expect(matchVoiceDestination("Mostra as reparações")).toBe("/jobs");
    expect(matchVoiceDestination("Abre as encomendas")).toBe("/purchase-orders");
    expect(matchVoiceDestination("Vai para o painel")).toBe("/");
  });

  it("não transforma pedidos de alteração ou eliminação em operações", () => {
    expect(matchVoiceDestination("Apaga todos os clientes")).toBeNull();
    expect(matchVoiceDestination("Muda o estado da reparação")).toBeNull();
  });

  it("reconhece ajuda", () => {
    expect(isVoiceHelpRequest("Que comandos tens?")).toBe(true);
  });
});
