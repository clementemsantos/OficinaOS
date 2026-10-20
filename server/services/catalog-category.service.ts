import type { Prisma, PrismaClient } from "@generated/client";
import { AppError } from "@shared/errors/app-error.js";
import type { CategoryScope } from "@shared/schemas/catalog-category";

type DB = PrismaClient | Prisma.TransactionClient;
export async function validateCategory(
  db: DB,
  scope: CategoryScope,
  id?: string | null
) {
  if (!id) {
    return;
  }
  const category = await db.catalogCategory.findUnique({ where: { id } });
  if (!category || category.scope !== scope || !category.isActive) {
    throw new AppError("VALIDATION_ERROR");
  }
}
export async function saveCategory(
  prisma: PrismaClient,
  scope: CategoryScope,
  input: { name: string; parentId: string | null; isActive: boolean },
  id?: string
) {
  return await prisma.$transaction(async (tx) => {
    // Reparenting and creation in the same tree must serialize to prevent cycles.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`catalog-category:${scope}`}))::text`;
    if (id) {
      const current = await tx.catalogCategory.findUnique({ where: { id } });
      if (!current || current.scope !== scope) {
        throw new AppError("NOT_FOUND");
      }
    }
    await validateParentPath(tx, scope, input.parentId, id);
    const data = {
      ...input,
      scope,
      nameKey: input.name.normalize("NFKC").toLocaleLowerCase("pt-PT"),
      parentKey: input.parentId ?? "",
    };
    const duplicate = await tx.catalogCategory.findFirst({
      where: {
        scope,
        parentKey: data.parentKey,
        nameKey: data.nameKey,
        ...(id ? { NOT: { id } } : {}),
      },
    });
    if (duplicate) {
      throw new AppError("VALIDATION_ERROR");
    }
    return id
      ? await tx.catalogCategory.update({ where: { id }, data })
      : await tx.catalogCategory.create({ data });
  });
}

async function validateParentPath(
  tx: DB,
  scope: CategoryScope,
  parentId: string | null,
  id?: string
) {
  let cursor = parentId;
  const visited = new Set<string>();
  while (cursor) {
    if (cursor === id || visited.has(cursor)) {
      throw new AppError("VALIDATION_ERROR");
    }
    visited.add(cursor);
    const parent = await tx.catalogCategory.findUnique({
      where: { id: cursor },
    });
    if (!parent || parent.scope !== scope || !parent.isActive) {
      throw new AppError("VALIDATION_ERROR");
    }
    cursor = parent.parentId;
  }
}
export async function categoryDescendants(
  db: DB,
  scope: CategoryScope,
  id: string
) {
  const rows = await db.catalogCategory.findMany({
    where: { scope },
    select: { id: true, parentId: true },
  });
  if (!rows.some((row) => row.id === id)) {
    throw new AppError("NOT_FOUND");
  }
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows) {
      if (row.parentId && ids.has(row.parentId) && !ids.has(row.id)) {
        ids.add(row.id);
        changed = true;
      }
    }
  }
  return [...ids];
}
