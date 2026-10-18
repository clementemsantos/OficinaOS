import { createHash } from "node:crypto";
import { AuditAction } from "@generated/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requirePermission } from "../middlewares/rbac.js";
import { createAuditLog } from "../services/audit.service.js";
import { getUserId } from "../utils/request.js";

// This archive is deliberately separate from the live operational entities:
// source IDs, duplicate customer phones, stock costs and unknown service
// prices are not lost while awaiting reviewed cross-system reconciliation.
const ENTITY_CONFIG = {
  customers: { idColumn: 1, required: ["ID KEYMASTER", "NOME"] },
  equipment: { idColumn: 1, required: ["ID", "MARCA", "MODELO"] },
  suppliers: { idColumn: 1, required: ["ID", "NOME"] },
  services: { idColumn: 4, required: ["REF.", "DESCRIÇÃO"] },
  stock: { idColumn: 4, required: ["REF.", "DESCRIÇÃO DA PEÇA"] },
} as const;

const types = ["customers", "equipment", "suppliers", "services", "stock"] as const;
const typeSchema = z.enum(types);
const recordSchema = z.object({
  sourceId: z.string().trim().min(1).max(200),
  rowNumber: z.number().int().min(2).max(20_003),
  values: z.array(z.string().max(16_384)).max(128),
});
const chunkSchema = z.object({
  entity: typeSchema,
  sourceFile: z.string().trim().min(1).max(255),
  headers: z.array(z.string().max(512)).max(128),
  records: z.array(recordSchema).min(1).max(50),
});
const normal = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");

function requireMisto() {
  return process.env.OFICINAOS_SANDBOX === "true";
}

// All routes are OWNER-only. The sandbox guard prevents accidentally enabling
// a migration tool in original production (4000) or legacy tests (4001).
// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const keymasterRoutes: FastifyPluginAsync = async (app) => {
  const guard = requirePermission({ settings: ["edit"] });

  app.get("/import/keymaster/status", { preHandler: guard }, async (_req, reply) => {
    if (!requireMisto()) {
      return reply.code(403).send({ message: "Disponível apenas no ambiente Misto." });
    }
    const groups = await app.prisma.externalImportRecord.groupBy({
      by: ["sourceEntity"],
      where: { sourceSystem: "KEYMASTER" },
      _count: { _all: true },
    });
    const counts = Object.fromEntries(types.map((entity) => [entity, 0]));
    for (const group of groups) {
      if (Object.hasOwn(counts, group.sourceEntity)) {
        counts[group.sourceEntity] = group._count._all;
      }
    }
    return reply.send({ counts, total: Object.values(counts).reduce((a, b) => a + b, 0) });
  });

  app.post(
    "/import/keymaster/archive",
    { preHandler: guard, bodyLimit: 5 * 1024 * 1024 },
    async (req, reply) => {
      if (!requireMisto()) {
        return reply.code(403).send({ message: "Disponível apenas no ambiente Misto." });
      }
      const parsed = chunkSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: "Lote inválido: revise colunas, referências ou tamanho." });
      }
      const { entity, headers, records, sourceFile } = parsed.data;
      const config = ENTITY_CONFIG[entity];
      const headerSet = new Set(headers.map(normal));
      if (config.required.some((column) => !headerSet.has(normal(column)))) {
        return reply.code(400).send({ message: "Cabeçalhos Keymaster não reconhecidos." });
      }
      const ids = new Set<string>();
      for (const row of records) {
        if (
          row.values[config.idColumn]?.trim() !== row.sourceId ||
          ids.has(row.sourceId)
        ) {
          return reply.code(400).send({ message: "Referência vazia, repetida ou incoerente no lote." });
        }
        ids.add(row.sourceId);
      }

      const original = await app.prisma.externalImportRecord.findMany({
        where: { sourceSystem: "KEYMASTER", sourceEntity: entity, sourceId: { in: [...ids] } },
        select: { sourceId: true, checksum: true },
      });
      const seen = new Map(original.map((r) => [r.sourceId, r.checksum]));
      const incoming = records.map((row) => ({
        sourceSystem: "KEYMASTER",
        sourceEntity: entity,
        sourceId: row.sourceId,
        sourceFile,
        sourceRow: row.rowNumber,
        headers,
        values: row.values,
        checksum: createHash("sha256")
          .update(JSON.stringify({ headers, values: row.values }))
          .digest("hex"),
      }));
      let unchanged = 0;
      let conflicts = 0;
      const candidates = [];
      for (const record of incoming) {
        const oldHash = seen.get(record.sourceId);
        if (oldHash === undefined) {
          candidates.push(record);
        } else if (oldHash === record.checksum) {
          unchanged++;
        } else {
          conflicts++;
        }
      }
      const result =
        candidates.length > 0
          ? await app.prisma.externalImportRecord.createMany({
              data: candidates,
              skipDuplicates: true,
            })
          : { count: 0 };
      // Concurrent duplicates are counted as skipped, never overwritten.
      unchanged += candidates.length - result.count;
      await createAuditLog(app.prisma, {
        action: AuditAction.DATA_IMPORTED,
        jobId: null,
        metadata: {
          sourceSystem: "KEYMASTER",
          entity,
          stored: result.count,
          unchanged,
          conflicts,
        },
        userId: getUserId(req),
      });
      return reply.send({ stored: result.count, unchanged, conflicts });
    }
  );
};
