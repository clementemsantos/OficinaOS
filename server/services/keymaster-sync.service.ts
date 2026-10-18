import type { Prisma, PrismaClient } from "@generated/client";

// Operational import reads ONLY the previously archived, immutable Keymaster
// records; data is never merged by phone, name or model. A source record is
// linked to exactly one new operational record after a successful transaction.
export type KeymasterEntity =
  | "customers"
  | "equipment"
  | "suppliers"
  | "services"
  | "stock";

interface OriginalRecord {
  headers: Prisma.JsonValue;
  id: string;
  operationalId: string | null;
  sourceId: string;
  values: Prisma.JsonValue;
}

export interface KeymasterSyncSummary {
  created: number;
  errors: { reference: string; reason: string }[];
  remaining: number;
}

const NORMALIZE_DIACRITICS = /[\u0300-\u036f]/g;
const NORMALIZE_SYMBOLS = /[^A-Z0-9]/g;
const PT_DECIMAL = /^-?\d+(?:[,.]\d+)?$/;

function normalized(name: string): string {
  return name
    .normalize("NFD")
    .replace(NORMALIZE_DIACRITICS, "")
    .toUpperCase()
    .replace(NORMALIZE_SYMBOLS, "");
}

function fields(record: OriginalRecord): Map<string, string> {
  const headers = Array.isArray(record.headers) ? record.headers : [];
  const values = Array.isArray(record.values) ? record.values : [];
  return new Map(
    headers.map((header, i) => [
      normalized(String(header ?? "")),
      String(values[i] ?? "").trim(),
    ])
  );
}

function field(map: Map<string, string>, ...names: string[]): string {
  for (const name of names) {
    const value = map.get(normalized(name));
    if (value) {
      return value;
    }
  }
  return "";
}

function amount(raw: string): number | null {
  const value = raw.trim().replace(/\s/g, "");
  if (!value) {
    return null;
  }
  let converted = value;
  if (converted.includes(",") && converted.includes(".")) {
    converted = converted.replace(/\./g, "").replace(",", ".");
  } else if (converted.includes(",")) {
    converted = converted.replace(",", ".");
  }
  if (!PT_DECIMAL.test(converted)) {
    return null;
  }
  const result = Number(converted);
  return Number.isFinite(result) ? result : null;
}

function required(value: string, fieldName: string): string {
  if (!value) {
    throw new Error(`Campo obrigatório em falta: ${fieldName}`);
  }
  return value;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: audited mapping for five independent source entity types
async function createOperational(
  tx: Prisma.TransactionClient,
  entity: KeymasterEntity,
  source: OriginalRecord,
  userId: string
): Promise<string> {
  const data = fields(source);
  switch (entity) {
    case "customers": {
      const customer = await tx.customer.create({
        data: {
          name:
            field(data, "NOME") ||
            `[Sem nome no Keymaster — ID ${source.sourceId}]`,
          phone: field(
            data,
            "TELEFONE 1",
            "TELEMOVEL",
            "TELEMÓVEL",
            "TELEFONE"
          ),
          email: field(data, "EMAIL 1", "EMAIL", "E-MAIL") || null,
          taxId: field(data, "NIF", "NÚMERO DE CONTRIBUINTE") || null,
          whatsappConsent: false,
        },
        select: { id: true },
      });
      return customer.id;
    }
    case "suppliers": {
      const supplier = await tx.supplier.create({
        data: {
          name: required(field(data, "NOME"), "nome"),
          email: field(data, "EMAIL", "E-MAIL") || null,
          phone: field(data, "TELEFONE 1", "TELEFONE", "TELEMOVEL") || null,
          taxId: field(data, "NIF") || null,
          address: field(data, "MORADA", "ENDEREÇO") || null,
        },
        select: { id: true },
      });
      return supplier.id;
    }
    case "equipment": {
      const equipment = await tx.customerEquipment.create({
        data: {
          sourceSystem: "KEYMASTER",
          sourceId: source.sourceId,
          brand: field(data, "MARCA") || null,
          model: field(data, "MODELO") || null,
          category: field(data, "TIPO DE EQUIPAMENTO", "TIPO") || null,
          serialNumber:
            field(data, "NUMERO DE SERIE", "NÚMERO DE SÉRIE", "SERIAL") || null,
          // No customer ID in the supplied source. Never infer ownership.
          customerId: null,
        },
        select: { id: true },
      });
      return equipment.id;
    }
    case "services": {
      const label = required(field(data, "DESCRIÇÃO"), "descrição");
      const price = amount(field(data, "PVP UNITÁRIO", "PVP"));
      // RepairCatalog still requires a numeric default. Distinguish
      // UNKNOWN from an actual 0 price with the new priceKnown flag.
      const existingName = await tx.repairCatalog.findUnique({
        where: { name: label },
        select: { id: true },
      });
      const service = await tx.repairCatalog.create({
        data: {
          name: existingName ? `${label} [KM ${source.sourceId}]` : label,
          category: "OTHER",
          defaultPrice: price ?? 0,
          priceKnown: price !== null,
          sourceReference: source.sourceId,
        },
        select: { id: true },
      });
      return service.id;
    }
    case "stock": {
      const label = required(field(data, "DESCRIÇÃO DA PEÇA"), "descrição");
      const price = amount(
        field(data, "PVP", "PVP UNITÁRIO", "PREÇO DE VENDA")
      );
      if (price !== null && price < 0) {
        throw new Error("PVP negativo: o artigo requer revisão.");
      }
      const rawStock = amount(field(data, "QTD.", "QTD", "QUANTIDADE"));
      if (rawStock === null || !Number.isSafeInteger(rawStock)) {
        throw new Error("Quantidade de stock inválida ou em falta.");
      }
      const cost = amount(field(data, "CUSTO", "PREÇO DE CUSTO"));
      const part = await tx.partsCatalog.create({
        data: {
          name: label,
          category: "OTHER",
          defaultPrice: price ?? 0,
          priceKnown: price !== null,
          acquisitionCost: cost,
          sourceReference: source.sourceId,
          stockQuantity: rawStock,
        },
        select: { id: true },
      });
      if (rawStock !== 0) {
        await tx.stockMovement.create({
          data: {
            partId: part.id,
            type: "ADJUSTMENT",
            quantity: rawStock,
            balanceAfter: rawStock,
            unitCost: cost,
            reference: `KEYMASTER:${source.sourceId}`,
            note: "Saldo inicial importado do Keymaster",
            createdById: userId,
          },
        });
      }
      return part.id;
    }
    default: {
      throw new Error("Tipo de registo Keymaster desconhecido.");
    }
  }
}

export async function syncKeymasterEntity(
  prisma: PrismaClient,
  entity: KeymasterEntity,
  userId: string
): Promise<KeymasterSyncSummary> {
  const sourceRows = await prisma.externalImportRecord.findMany({
    where: {
      sourceSystem: "KEYMASTER",
      sourceEntity: entity,
      operationalId: null,
      syncError: null,
    },
    select: {
      id: true,
      headers: true,
      values: true,
      operationalId: true,
      sourceId: true,
    },
    orderBy: [{ sourceRow: "asc" }, { id: "asc" }],
    take: 25,
  });
  const errors: KeymasterSyncSummary["errors"] = [];
  let created = 0;
  for (const source of sourceRows) {
    try {
      await prisma.$transaction(async (tx) => {
        // Lock the source row, so concurrent "sync" clicks don't create
        // two canonical records for one Keymaster ID.
        await tx.$queryRaw`SELECT "id" FROM "external_import_records"
          WHERE "id" = ${source.id} FOR UPDATE`;
        const fresh = await tx.externalImportRecord.findUniqueOrThrow({
          where: { id: source.id },
          select: { operationalId: true },
        });
        if (fresh.operationalId) {
          return;
        }
        const operationalId = await createOperational(
            tx,
            entity,
            source,
            userId
          );
        await tx.externalImportRecord.update({
          where: { id: source.id },
          data: { operationalId, syncedAt: new Date() },
        });
        created++;
      });
    } catch (error) {
      const reason =
        error instanceof Error && error.message.startsWith("Campo obrigatório")
          ? error.message
          : "Incompatibilidade de dados: consultar o registo original.";
      await prisma.externalImportRecord.update({
        where: { id: source.id },
        data: { syncError: reason },
      });
      errors.push({ reference: source.sourceId, reason });
    }
  }
  const remaining = await prisma.externalImportRecord.count({
    where: {
      sourceSystem: "KEYMASTER",
      sourceEntity: entity,
      operationalId: null,
      syncError: null,
    },
  });
  return { created, errors, remaining };
}
