import type { OwnerDashboardDTO } from "@shared/types/dashboard";
import { normalizeVoice } from "@/lib/inovito-voice-commands";

type OwnerSnapshot = Pick<
  OwnerDashboardDTO,
  "activeJobs" | "completedToday" | "overdueJobs" | "pickupReady"
>;

const SHOP_SUMMARY_PATTERN =
  /\b(resumo|ponto|balanco|situacao|estado)\b.*\b(loja|oficina|dia)\b/;
const OPEN_JOBS_PATTERN =
  /\bquantas?\b.*\b(reparacoes|obras|servicos)\b.*\b(abertas?|ativas?|pendentes?)\b/;

export function isOwnerSummaryRequest(command: string): boolean {
  const normalized = normalizeVoice(command);
  return SHOP_SUMMARY_PATTERN.test(normalized) || OPEN_JOBS_PATTERN.test(normalized);
}

function plural(value: number, singular: string, multiple: string): string {
  return value === 1 ? singular : multiple;
}

/** Só agregados, sem nomes, contactos, valores financeiros nem detalhes de clientes. */
export function formatOwnerSummary(data: OwnerSnapshot): string {
  const active = data.activeJobs;
  const done = data.completedToday;
  const overdue = data.overdueJobs.length;
  const pickup = data.pickupReady.length;

  const lines = [
    "Segundo o painel do OficinaOS, há " +
      active +
      " " +
      plural(active, "serviço ativo", "serviços ativos") +
      ".",
    "Hoje foram concluídos " +
      done +
      " " +
      plural(done, "serviço", "serviços") +
      ".",
    "Nas listas consultadas aparecem " +
      overdue +
      " " +
      plural(overdue, "reparação em atraso", "reparações em atraso") +
      " e " +
      pickup +
      " " +
      plural(pickup, "equipamento pronto", "equipamentos prontos") +
      " para recolha.",
    "As listas podem não incluir todos os registos.",
  ];
  return lines.join(" ");
}
