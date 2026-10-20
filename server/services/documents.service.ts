import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Prisma, PrismaClient } from "@generated/client";
import { AppError } from "@shared/errors/app-error.js";
import { loadEnv } from "../config/env.js";

const STORAGE_KEY = /^[a-f0-9-]{36}$/;
export const DOCUMENT_LIMIT = 5 * 1024 * 1024;
export function documentPath(key: string) {
  if (!STORAGE_KEY.test(key)) {
    throw new AppError("NOT_FOUND");
  }
  return path.resolve(loadEnv().UPLOAD_DIR, ".documents", key);
}
export function documentName(name: string) {
  return (
    Array.from(name)
      .map((character) => {
        const code = character.codePointAt(0) ?? 0;
        return code < 32 ||
          code === 127 ||
          character === "/" ||
          character === "\\"
          ? "_"
          : character;
      })
      .join("")
      .slice(0, 200) || "document"
  );
}
export async function storeDocument(
  db: PrismaClient | Prisma.TransactionClient,
  name: string,
  bytes: Buffer,
  entityType: string,
  entityId: string
) {
  if (bytes.length > DOCUMENT_LIMIT) {
    throw new AppError("FILE_TOO_LARGE");
  }
  const storageKey = randomUUID();
  const location = documentPath(storageKey);
  await fs.mkdir(path.dirname(location), { recursive: true, mode: 0o700 });
  await fs.writeFile(location, bytes, { flag: "wx", mode: 0o600 });
  try {
    return await db.documentAsset.create({
      data: {
        storageKey,
        name: documentName(name),
        size: bytes.length,
        checksum: createHash("sha256").update(bytes).digest("hex"),
        links: { create: { entityType, entityId } },
      },
      select: { id: true, name: true, size: true, createdAt: true },
    });
  } catch (error) {
    await fs.unlink(location);
    throw error;
  }
}
