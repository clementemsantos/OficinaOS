/** Comandos de voz locais. Não executam operações nem fazem pedidos à API. */
export function normalizeVoice(text: string): string {
  return text
    .toLocaleLowerCase("pt-PT")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,!?;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type HeardVoice =
  | { kind: "ignore" }
  | { kind: "wake" }
  | { kind: "command"; text: string };

/** A palavra de ativação é exigida, exceto durante a janela após "Inovito". */
export function parseVoiceInput(
  transcript: string,
  awaitingCommand = false
): HeardVoice {
  const normalized = normalizeVoice(transcript);
  const match = /\binovito\b/.exec(normalized);
  if (match) {
    const afterWake = normalized.slice(match.index + match[0].length).trim();
    return afterWake ? { kind: "command", text: afterWake } : { kind: "wake" };
  }
  if (awaitingCommand && normalized) {
    return { kind: "command", text: normalized };
  }
  return { kind: "ignore" };
}

const DESTINATIONS: ReadonlyArray<{ pattern: RegExp; path: string }> = [
  { pattern: /\b(encomendas?|compras?)\b/, path: "/purchase-orders" },
  { pattern: /\b(tarefas?|pendencias?)\b/, path: "/tasks" },
  { pattern: /\b(reparacoes?|obras?|servicos?)\b/, path: "/jobs" },
  { pattern: /\b(clientes?)\b/, path: "/customers" },
  { pattern: /\b(fornecedores?)\b/, path: "/suppliers" },
  { pattern: /\b(stock|inventario|pecas?)\b/, path: "/parts" },
  { pattern: /\b(relatorios?|estatisticas?)\b/, path: "/reports" },
  { pattern: /\b(assistente|inteligencia artificial|analista)\b/, path: "/ai-analyst" },
  { pattern: /\b(painel|inicio|principal)\b/, path: "/" },
  { pattern: /\b(ajuda|manual)\b/, path: "/help" },
];

/** Navegação permitida apenas para comandos explícitos de consulta/abertura. */
export function matchVoiceDestination(command: string): string | null {
  const normalized = normalizeVoice(command);
  if (!/\b(abrir|abre|mostra|mostrar|ver|consulta|consultar|vai|ir|aceder)\b/.test(normalized)) {
    return null;
  }
  return DESTINATIONS.find((destination) =>
    destination.pattern.test(normalized)
  )?.path ?? null;
}

export function isVoiceHelpRequest(command: string): boolean {
  return /\b(o que podes fazer|ajuda me|como funcionas|comandos)\b/.test(
    normalizeVoice(command)
  );
}
