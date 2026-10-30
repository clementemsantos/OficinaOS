import { normalizeVoice } from "@/lib/inovito-voice-commands";

const TASK_PATTERN = /\btarefas?\b/;
const COUNT_PATTERN =
  /\b(quantas?|numero|total|resumo|pendentes?|por fazer|por concluir)\b/;
const ASK_AI_PATTERN =
  /^(?:pergunta|perguntar) (?:ao|a) (?:assistente|inovito|ia|inteligencia artificial) (.+)$/;
const MAX_QUESTION_LENGTH = 500;

export interface PendingTasksPage {
  data: unknown[];
  nextCursor?: string | null;
}

/** Pede uma contagem, nunca a enumeração de títulos ou nomes pessoais. */
export function isPendingTasksRequest(phrase: string): boolean {
  const normalized = normalizeVoice(phrase);
  return TASK_PATTERN.test(normalized) && COUNT_PATTERN.test(normalized);
}

/** O endpoint devolve até 100 tarefas, pelo que uma página não é necessariamente o total. */
export function formatPendingTasks(page: PendingTasksPage): string {
  const count = page.data.length;
  if (page.nextCursor) {
    return (
      "Há pelo menos " +
      count +
      " tarefas por concluir visíveis para a tua conta. " +
      "Existem mais páginas. Abre as tarefas para veres a lista completa."
    );
  }
  return (
    "Há " +
    count +
    " tarefas por concluir visíveis para a tua conta no OficinaOS."
  );
}

/** Prepara uma questão para revisão humana no chat; nunca a envia automaticamente. */
export function extractAiQuestion(phrase: string): string | null {
  const match = ASK_AI_PATTERN.exec(normalizeVoice(phrase));
  const question = match?.[1]?.trim();
  if (!question || question.length > MAX_QUESTION_LENGTH) {
    return null;
  }
  return question;
}

/** O router state é não confiável: só aceitamos texto curto e simples. */
export function readInovitoDraft(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("inovitoDraft" in value)) {
    return null;
  }
  const draft = value.inovitoDraft;
  if (typeof draft !== "string") {
    return null;
  }
  const trimmed = draft.trim();
  if (!(trimmed && trimmed.length <= MAX_QUESTION_LENGTH)) {
    return null;
  }
  return trimmed;
}
