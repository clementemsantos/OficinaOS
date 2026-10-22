import { randomBytes } from "node:crypto";
import { AuditAction, type PrismaClient } from "@generated/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requirePermission } from "../middlewares/rbac.js";
import { generateJobCode } from "../utils/job-code.js";
import { getUserId } from "../utils/request.js";

// Never merge people on name/phone or manufacture diagnoses, payments, notes,
// customer ownership or historical job-status transitions from a simple list.
const sourceRow = z.object({
  reference: z
    .string()
    .regex(/^20\d{2}\/\d{1,7}$/)
    .max(40),
  dateOriginal: z.string().trim().min(1).max(20),
  timeOriginal: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/),
  pvp: z.number().nonnegative().finite().max(99_999_999.99),
  equipment: z.string().trim().max(160),
  customer: z.string().trim().max(160),
  stage: z.string().trim().max(120),
  stateOriginal: z.string().trim().max(180),
  attributedTo: z.string().trim().max(120),
});
const importBody = z.object({
  rows: z.array(sourceRow).min(1).max(100),
});
const applyBody = importBody.extend({
  confirm: z.literal("IMPORTAR_OBRAS_ATIVAS_KEYMASTER"),
});
type SourceRow = z.infer<typeof sourceRow>;
type JobStatus =
  | "INTAKE"
  | "WAITING_FOR_PARTS"
  | "IN_REPAIR"
  | "ON_HOLD"
  | "DONE";
interface ItemResult {
  action: "create" | "already_imported" | "needs_review";
  customerId: string | null;
  reason: string;
  reference: string;
  status: JobStatus;
}
const DIACRITICS = /[\u0300-\u036f]/g;
const SPACES = /\s+/g;
const IPHONE_PREFIX = /^iphone\s/i;
function normalize(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .trim()
    .replace(SPACES, " ")
    .toUpperCase();
}

function mapStatus(state: string): JobStatus {
  const status = normalize(state);
  if (status.includes("CONCLUIDO") && status.includes("RECOLHA")) {
    return "DONE"; // Work finished ≠ delivered.
  }
  if (status.includes("EM REPARACAO")) {
    return "IN_REPAIR";
  }
  if (status.includes("DIAGNOSTICO")) {
    return "INTAKE";
  }
  if (
    status.includes("AGUARDAR STOCK") ||
    status.includes("ENCOMENDA DE PRODUTOS") ||
    status.includes("COMPRA/CHEGADA")
  ) {
    return "WAITING_FOR_PARTS";
  }
  // All other / empty / unknown source states remain conservatively ON_HOLD.
  // Exact original state is stored in legacyImport, not silently discarded.
  return "ON_HOLD";
}

function dateFromSource(row: SourceRow): Date | null {
  const year = Number(row.reference.slice(0, 4));
  const pieces = row.dateOriginal.split("/");
  if (pieces.length !== 2 && pieces.length !== 3) {
    return null;
  }
  const day = Number(pieces[0]);
  const month = Number(pieces[1]);
  const suppliedYear = pieces.length === 3 ? Number(pieces[2]) : year;
  const [hour, minute] = row.timeOriginal.split(":").map(Number);
  if (
    suppliedYear !== year ||
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  const d = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() + 1 !== month ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  // Historical date/time comes from a local Portugal listing. Compute
  // Europe/Lisbon offset at that date, including DST, and keep the raw
  // cell values separately for later verification.
  const zone = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    timeZoneName: "shortOffset",
  })
    .formatToParts(d)
    .find((part) => part.type === "timeZoneName")?.value;
  const offsetHours = Number(zone?.replace("GMT", "") || 0);
  return new Date(d.getTime() - offsetHours * 3_600_000);
}

function customerMatches(
  row: SourceRow,
  customers: { id: string; name: string }[]
): { id: string; name: string }[] {
  if (!row.customer) {
    return [];
  }
  const target = normalize(row.customer);
  return customers.filter((customer) => normalize(customer.name) === target);
}

const BRAND_PREFIXES = [
  "Samsung",
  "HP",
  "Acer",
  "Oppo",
  "Lenovo",
  "Asus",
  "Huawei",
  "Xiaomi",
];
function identifyModel(raw: string): { brand: string; model: string } {
  const trimmed = raw.trim();
  if (IPHONE_PREFIX.test(trimmed)) {
    return { brand: "Apple", model: trimmed };
  }
  for (const brand of BRAND_PREFIXES) {
    if (trimmed.toLowerCase().startsWith(`${brand.toLowerCase()} `)) {
      return { brand, model: trimmed.slice(brand.length).trim() };
    }
  }
  return { brand: "Marca não indicada (Keymaster)", model: trimmed };
}

async function classify(
  prisma: PrismaClient,
  rows: SourceRow[]
): Promise<ItemResult[]> {
  const [customers, existing] = await Promise.all([
    prisma.customer.findMany({
      select: { id: true, name: true },
      take: 50_000,
    }),
    prisma.job.findMany({
      where: {
        externalRef: { in: rows.map((r) => `KEYMASTER:${r.reference}`) },
      },
      select: { externalRef: true },
    }),
  ]);
  const existingRefs = new Set(existing.map((row) => row.externalRef));
  const refs = new Set<string>();
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: explicit safety checks for source-job imports
  return rows.map((row) => {
    const status = mapStatus(row.stateOriginal);
    const result = {
      reference: row.reference,
      action: "needs_review" as ItemResult["action"],
      reason: "",
      status,
      customerId: null as string | null,
    };
    if (refs.has(row.reference)) {
      result.reason = "Referência duplicada no ficheiro.";
    } else if (existingRefs.has(`KEYMASTER:${row.reference}`)) {
      result.action = "already_imported";
      result.reason = "Esta obra já existe no OficinaOS.";
    } else if (
      !row.equipment ||
      normalize(row.equipment) === "SEM EQUIPAMENTO"
    ) {
      result.reason = "Equipamento não identificado; precisa de revisão.";
    } else if (normalize(row.stateOriginal).includes("VENDA")) {
      result.reason =
        "Folha de venda: confirmar se deve entrar como reparação.";
    } else if (!row.stateOriginal) {
      result.reason = "Estado de serviço em falta; requer confirmação.";
    } else if (!row.customer) {
      result.reason = "Cliente não indicado; requer confirmação.";
    } else if (dateFromSource(row)) {
      const matches = customerMatches(row, customers);
      if (matches.length === 1) {
        result.customerId = matches[0]?.id ?? null;
        result.action = "create";
        result.reason = row.stateOriginal
          ? "Ficha de cliente identificada por nome exato."
          : "Sem estado de origem; importará em espera de revisão.";
      } else {
        result.reason =
          matches.length === 0
            ? "Cliente não encontrado pelo nome; conferir a ficha."
            : "Várias fichas de cliente com o mesmo nome; associação ambígua.";
      }
    } else {
      result.reason = "Data ou hora inválida; requer confirmação.";
    }
    refs.add(row.reference);
    return result;
  });
}

// Owner-only, sandbox-only. Preview never writes anything. Apply creates
// at most 100 jobs in per-row transactions with idempotent externalRef keys.
// Historical listing does NOT contain diagnoses or payments: no payment,
// invoice, signature, original note, delivery or customer message is created.
// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const keymasterActiveJobsRoutes: FastifyPluginAsync = async (app) => {
  const guard = requirePermission({ settings: ["edit"] });

  app.post(
    "/import/keymaster/active-jobs/preview",
    { preHandler: guard },
    async (req, reply) => {
      if (process.env.OFICINAOS_SANDBOX !== "true") {
        return reply.code(403).send({ message: "Apenas no Misto." });
      }
      const parsed = importBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: "Listagem inválida." });
      }
      const items = await classify(app.prisma, parsed.data.rows);
      return reply.send({ items });
    }
  );

  app.post(
    "/import/keymaster/active-jobs/apply",
    { preHandler: guard },
    async (req, reply) => {
      if (process.env.OFICINAOS_SANDBOX !== "true") {
        return reply.code(403).send({ message: "Apenas no Misto." });
      }
      const parsed = applyBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: "Importação não confirmada." });
      }
      const rows = parsed.data.rows;
      const decisions = await classify(app.prisma, rows);
      const userId = getUserId(req);
      const items: ItemResult[] = [];
      for (const [index, decision] of decisions.entries()) {
        if (decision.action !== "create" || !decision.customerId) {
          items.push(decision);
          continue;
        }
        const row = rows[index];
        if (!row) {
          continue;
        }
        try {
          const customerId = decision.customerId;
          await app.prisma.$transaction(async (tx) => {
            const externalRef = `KEYMASTER:${row.reference}`;
            const prior = await tx.job.findUnique({
              where: { externalRef },
              select: { id: true },
            });
            if (prior) {
              return;
            }
            const { brand: brandName, model } = identifyModel(row.equipment);
            const brand = await tx.brand.upsert({
              where: { name: brandName },
              update: {},
              create: { name: brandName },
            });
            const device = await tx.device.upsert({
              where: { brandId_model: { brandId: brand.id, model } },
              update: {},
              create: { brandId: brand.id, model },
            });
            const generated = await generateJobCode(tx as PrismaClient);
            const job = await tx.job.create({
              data: {
                jobCode: generated.jobCode,
                accessCode: randomBytes(8).toString("hex"),
                externalRef,
                customerId,
                deviceId: device.id,
                status: decision.status,
                createdAt: dateFromSource(row) ?? new Date(),
                estimatedCost: row.pvp > 0 ? row.pvp : null,
                reportedProblem:
                  "Não indicado na listagem Keymaster; completar diagnóstico.",
                conditionNotes:
                  "Dados migrados de uma LISTAGEM, não do histórico completo da obra. " +
                  `Nº original: ${row.reference}. ` +
                  `Etapa original: ${row.stage || "não indicada"}. ` +
                  `Estado original: ${row.stateOriginal || "não indicado"}.`,
                legacyImport: {
                  sourceSystem: "KEYMASTER",
                  sourceType: "ACTIVE_JOB_LIST",
                  ...row,
                  yearInferredFromReference:
                    row.dateOriginal.split("/").length === 2,
                },
                createdById: userId,
              },
              select: { id: true },
            });
            await tx.auditLog.create({
              data: {
                action: AuditAction.DATA_IMPORTED,
                userId,
                jobId: job.id,
                note: "Ficha criada a partir da listagem de obras ativas Keymaster (sem histórico/anexos).",
                metadata: {
                  sourceSystem: "KEYMASTER",
                  originalRef: row.reference,
                  originalState: row.stateOriginal,
                  originalStage: row.stage,
                },
              },
            });
          });
          items.push({ ...decision, reason: "Ficha criada ou já existente." });
        } catch {
          items.push({
            ...decision,
            action: "needs_review",
            reason:
              "Não foi possível criar esta obra; verificar conflitos e tentar novamente.",
          });
        }
      }
      return reply.send({ items });
    }
  );
};
