
import crypto from "node:crypto";
import { AuditAction } from "@generated/client";
import type { PrismaClient } from "@generated/client";
import { generateJobCode } from "../utils/job-code.js";

// Preserves the list supplied by the shop, but does NOT claim that it
// contains the original fault description, audit trail, media or payments.
export interface KeymasterJobRow {
  approval: string;
  assignedTo: string;
  customerName: string;
  dateOriginal: string;
  deviceName: string;
  jobRef: string;
  pvpText: string;
  sourceStatus: string;
  timeOriginal: string;
}

export interface KeymasterJobIssue {
  jobRef: string;
  reason: string;
}

export interface KeymasterJobResult {
  created: number;
  existing: number;
  issues: KeymasterJobIssue[];
  ready: number;
  total: number;
}

const DIACRITICS = /[\u0300-\u036f]/g;
const PUNCTUATION = /[^a-z0-9]+/g;
const REFERENCE = /^(20\d{2})\/(\d{1,6})$/;
const SHORT_DATE = /^(\d{2})\/(\d{2})(?:\/(20\d{2}))?$/;
const CLOCK = /^(\d{2}):(\d{2})$/;
const MONEY = /^(\d{1,8}),([0-9]{2})$/;
const UNCLASSIFIED_BRAND = "Keymaster (por classificar)";
const RAW_FAULT = "Avaria não indicada na listagem importada do Keymaster.";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(PUNCTUATION, " ")
    .trim();
}

function money(raw: string): number | null {
  const match = MONEY.exec(raw.trim().replace(/\s*€/g, ""));
  return match ? Number(match[1]) + Number(match[2]) / 100 : null;
}

function sourceDate(row: KeymasterJobRow): Date | null {
  const reference = REFERENCE.exec(row.jobRef.trim());
  const date = SHORT_DATE.exec(row.dateOriginal.trim());
  const clock = CLOCK.exec(row.timeOriginal.trim());
  if (!(reference && date && clock)) {
    return null;
  }
  const year = Number(reference[1]);
  if (date[3] && Number(date[3]) !== year) {
    return null;
  }
  const month = Number(date[2]);
  const day = Number(date[1]);
  const hour = Number(clock[1]);
  const minute = Number(clock[2]);
  const naive = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (
    naive.getUTCFullYear() !== year ||
    naive.getUTCMonth() !== month - 1 ||
    naive.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }
  // All source dates are local to Portugal. Convert safely to a UTC instant;
  // raw source clock/year assumptions remain written verbatim in notes.
  const zone = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Lisbon",
    timeZoneName: "shortOffset",
  }).formatToParts(naive);
  const label = zone.find((part) => part.type === "timeZoneName")?.value ?? "";
  const offset = /GMT([+-]\d+)?/.exec(label);
  if (!offset) {
    return null;
  }
  return new Date(naive.getTime() - Number(offset[1] ?? 0) * 3_600_000);
}

function mappedStatus(sourceStatus: string):
  | "DONE"
  | "WAITING_FOR_PARTS"
  | "ON_HOLD" {
  const value = normalize(sourceStatus);
  if (value.includes("concluido") && value.includes("recolha")) {
    return "DONE";
  }
  if (
    value.includes("aguardar stock") ||
    value.includes("encomenda de produtos") ||
    value.includes("compra chegada de produtos")
  ) {
    return "WAITING_FOR_PARTS";
  }
  // Unknown states stay ON_HOLD with the literal Keymaster state retained
  // in the case notes. Never mark anything DELIVERED from this list.
  return "ON_HOLD";
}

function provenance(row: KeymasterJobRow): string {
  const year = REFERENCE.exec(row.jobRef)?.[1];
  const assumed = row.dateOriginal.includes(year ?? "/") ? "" : " (ano inferido do nº da obra)";
  return [
    "Dados importados de uma LISTAGEM RESUMIDA do Keymaster.",
    "NÃO contém diagnóstico, histórico completo, pagamentos nem anexos.",
    `Folha original: ${row.jobRef}`,
    `Data original: ${row.dateOriginal} ${row.timeOriginal}${assumed}`,
    `PVP Cliente (não é pagamento): ${row.pvpText} €`,
    `Etapa de aprovação: ${row.approval}`,
    `Estado original Keymaster: ${row.sourceStatus}`,
    `Atribuído na origem: ${row.assignedTo || "não indicado"}`,
    `Equipamento original: ${row.deviceName}`,
  ].join("\n");
}

function validateRow(row: KeymasterJobRow): string | null {
  if (!REFERENCE.test(row.jobRef)) {
    return "Número de folha inválido.";
  }
  if (!(row.customerName.trim() && row.deviceName.trim() && row.sourceStatus.trim())) {
    return "Cliente, equipamento ou estado em falta.";
  }
  if (row.deviceName.length > 120) {
    return "Nome do equipamento demasiado longo.";
  }
  if (!sourceDate(row)) {
    return "Data ou hora inválida (o ano é retirado do nº da folha).";
  }
  if (money(row.pvpText) === null) {
    return "Valor PVP inválido; deve ter vírgula e dois decimais.";
  }
  return null;
}

type PreparedRow = { row: KeymasterJobRow; customerId: string; createdAt: Date; price: number };

async function assess(prisma: PrismaClient, rows: KeymasterJobRow[]) {
  const references = rows.map((row) => `KEYMASTER:${row.jobRef.trim()}`);
  const [customers, existingJobs] = await Promise.all([
    prisma.customer.findMany({ select: { id: true, name: true } }),
    prisma.job.findMany({
      where: { externalRef: { in: references } },
      select: { externalRef: true },
    }),
  ]);
  const byName = new Map<string, string[]>();
  for (const customer of customers) {
    const key = normalize(customer.name);
    const ids = byName.get(key) ?? [];
    ids.push(customer.id);
    byName.set(key, ids);
  }
  const existing = new Set(existingJobs.map((job) => job.externalRef));
  const batchRefs = new Set<string>();
  const ready: PreparedRow[] = [];
  const issues: KeymasterJobIssue[] = [];
  let already = 0;
  for (const row of rows) {
    const jobRef = row.jobRef.trim();
    if (batchRefs.has(jobRef)) {
      issues.push({ jobRef, reason: "Referência repetida neste ficheiro." });
      continue;
    }
    batchRefs.add(jobRef);
    const problem = validateRow(row);
    if (problem) {
      issues.push({ jobRef, reason: problem });
      continue;
    }
    if (existing.has(`KEYMASTER:${jobRef}`)) {
      already++;
      continue;
    }
    const matches = byName.get(normalize(row.customerName)) ?? [];
    if (matches.length !== 1) {
      issues.push({
        jobRef,
        reason:
          matches.length === 0
            ? "Cliente não encontrado com este nome exato no OficinaOS."
            : "Há vários clientes com este nome; associação exige escolha manual.",
      });
      continue;
    }
    const createdAt = sourceDate(row);
    const price = money(row.pvpText);
    if (!(createdAt && price !== null)) {
      continue;
    }
    ready.push({ row, customerId: matches[0], createdAt, price });
  }
  return { ready, issues, existing: already };
}

/** Preview or create legitimate jobs only, without fake customer records. */
export async function importKeymasterJobs(
  prisma: PrismaClient,
  rows: KeymasterJobRow[],
  userId: string,
  dryRun: boolean
): Promise<KeymasterJobResult> {
  const prepared = await assess(prisma, rows);
  let created = 0;
  let already = prepared.existing;
  const issues = [...prepared.issues];
  if (!dryRun) {
    for (const item of prepared.ready) {
      const externalRef = `KEYMASTER:${item.row.jobRef.trim()}`;
      try {
        const status = mappedStatus(item.row.sourceStatus);
        const inserted = await prisma.$transaction(async (tx) => {
          const found = await tx.job.findUnique({
            where: { externalRef },
            select: { id: true },
          });
          if (found) {
            return false;
          }
          const brand = await tx.brand.upsert({
            where: { name: UNCLASSIFIED_BRAND },
            update: {},
            create: { name: UNCLASSIFIED_BRAND },
          });
          const device = await tx.device.upsert({
            where: {
              brandId_model: {
                brandId: brand.id,
                model: item.row.deviceName.trim(),
              },
            },
            update: {},
            create: {
              brandId: brand.id,
              model: item.row.deviceName.trim(),
              category: null,
            },
          });
          const identity = await generateJobCode(tx as PrismaClient);
          const job = await tx.job.create({
            data: {
              accessCode: identity.accessCode || crypto.randomBytes(8).toString("hex"),
              jobCode: identity.jobCode,
              externalRef,
              customerId: item.customerId,
              deviceId: device.id,
              status,
              reportedProblem: RAW_FAULT,
              estimatedCost: item.price,
              conditionNotes: provenance(item.row),
              createdAt: item.createdAt,
              createdById: userId,
            },
          });
          await tx.auditLog.create({
            data: {
              action: AuditAction.DATA_IMPORTED,
              userId,
              jobId: job.id,
              metadata: {
                source: "KEYMASTER",
                originalRef: item.row.jobRef,
                approval: item.row.approval,
                originalStatus: item.row.sourceStatus,
                originalDate: item.row.dateOriginal,
                originalTime: item.row.timeOriginal,
                originalDevice: item.row.deviceName,
                originalPvp: item.row.pvpText,
                currentStatusMapping: status,
                partialListing: true,
              },
            },
          });
          return true;
        });
        if (inserted) {
          created++;
        } else {
          already++;
        }
      } catch {
        issues.push({
          jobRef: item.row.jobRef,
          reason: "Erro ao criar ficha; não foi alterada a ficha de origem.",
        });
      }
    }
  }
  return {
    created,
    existing: already,
    issues,
    ready: prepared.ready.length,
    total: rows.length,
  };
}
