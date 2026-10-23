import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { AppError } from "@shared/errors/app-error.js";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import { loadEnv } from "../config/env.js";
import { requirePermission } from "../middlewares/rbac.js";
import { parseInput } from "../utils/parse-input.js";
import { getUserId } from "../utils/request.js";

const idSchema = z.object({ id: z.string().min(1).max(100) });
const mediaIdSchema = idSchema.extend({ mediaId: z.string().min(1).max(100) });
const entryFields = z.object({
  title: z.string().trim().min(5).max(180),
  summary: z.string().trim().min(10).max(600),
  content: z.string().trim().min(20).max(50_000),
  category: z.enum([
    "phone",
    "tablet",
    "laptop",
    "desktop",
    "console",
    "printer",
    "general",
  ]),
  brand: z.string().trim().max(80).optional().nullable(),
  model: z.string().trim().max(120).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  difficulty: z
    .enum(["Inicial", "Intermédio", "Avançado"])
    .default("Intermédio"),
});
const querySchema = z.object({
  q: z.string().max(100).optional(),
  category: z.string().max(32).optional(),
});
type Entry = { authorId: string; status: string };
type AtlasInput = z.infer<typeof entryFields>;

function allowViewing(req: FastifyRequest, entry: Entry) {
  if (
    entry.status !== "SHOP" &&
    req.user?.role !== "OWNER" &&
    entry.authorId !== getUserId(req)
  ) {
    throw new AppError("NOT_FOUND");
  }
}

function requireEditor(req: FastifyRequest) {
  if (!["OWNER", "TECHNICIAN"].includes(req.user?.role ?? "")) {
    throw new AppError("FORBIDDEN");
  }
}

function allowEditing(req: FastifyRequest, entry: Entry) {
  requireEditor(req);
  if (req.user?.role !== "OWNER" && entry.authorId !== getUserId(req)) {
    throw new AppError("FORBIDDEN");
  }
}

function atlasStoragePath(key: string) {
  if (!/^[a-f0-9-]{36}$/.test(key)) {
    throw new AppError("NOT_FOUND");
  }
  return path.resolve(loadEnv().UPLOAD_DIR, ".atlas", key);
}

function mimeOf(buffer: Buffer): string | null {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff &&
    buffer.at(-1) === 0xd9
  ) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function normalizedTags(tags: string[]) {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

function prepared(input: AtlasInput) {
  return { ...input, tags: normalizedTags(input.tags) };
}

export const atlasRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requirePermission({ jobs: ["view"] }));

  app.get("/entries", async (req) => {
    const { q, category } = parseInput(querySchema, req.query);
    const userId = getUserId(req);
    const where = {
      AND: [
        req.user?.role === "OWNER"
          ? {}
          : { OR: [{ status: "SHOP" }, { authorId: userId }] },
        category ? { category } : {},
        q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" as const } },
                { summary: { contains: q, mode: "insensitive" as const } },
                { model: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {},
      ],
    };
    const entries = await app.prisma.atlasEntry.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: { images: { orderBy: { createdAt: "asc" }, take: 1 } },
    });
    return { data: entries };
  });

  app.get("/entries/:id", async (req) => {
    const { id } = parseInput(idSchema, req.params);
    const entry = await app.prisma.atlasEntry.findUnique({
      where: { id },
      include: { images: { orderBy: { createdAt: "asc" } } },
    });
    if (!entry) {
      throw new AppError("NOT_FOUND");
    }
    allowViewing(req, entry);
    return { data: entry };
  });

  app.post("/entries", async (req, reply) => {
    requireEditor(req);
    const input = prepared(parseInput(entryFields, req.body));
    const authorId = getUserId(req);
    const entry = await app.prisma.atlasEntry.create({
      data: {
        ...input,
        authorId,
        revisions: {
          create: { number: 1, snapshot: input, editorId: authorId },
        },
      },
    });
    return reply.code(201).send({ data: entry });
  });

  app.patch("/entries/:id", async (req) => {
    const { id } = parseInput(idSchema, req.params);
    const input = prepared(parseInput(entryFields, req.body));
    const entry = await app.prisma.atlasEntry.findUnique({ where: { id } });
    if (!entry) {
      throw new AppError("NOT_FOUND");
    }
    allowEditing(req, entry);
    // Changing a published guide returns it to a private draft pending owner's review.
    const latest = await app.prisma.atlasRevision.aggregate({
      where: { entryId: id },
      _max: { number: true },
    });
    const updated = await app.prisma.atlasEntry.update({
      where: { id },
      data: {
        ...input,
        status: "DRAFT",
        revisions: {
          create: {
            number: (latest._max.number ?? 0) + 1,
            snapshot: input,
            editorId: getUserId(req),
          },
        },
      },
    });
    return { data: updated };
  });

  app.post("/entries/:id/publish", async (req) => {
    if (req.user?.role !== "OWNER") {
      throw new AppError("FORBIDDEN");
    }
    const { id } = parseInput(idSchema, req.params);
    const existing = await app.prisma.atlasEntry.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError("NOT_FOUND");
    }
    const result = await app.prisma.atlasEntry.update({
      where: { id },
      data: { status: "SHOP" },
    });
    return { data: result };
  });

  app.post("/entries/:id/media", async (req, reply) => {
    const { id } = parseInput(idSchema, req.params);
    const entry = await app.prisma.atlasEntry.findUnique({ where: { id } });
    if (!entry) {
      throw new AppError("NOT_FOUND");
    }
    allowEditing(req, entry);
    const count = await app.prisma.atlasMedia.count({ where: { entryId: id } });
    if (count >= 12) {
      throw new AppError("VALIDATION_ERROR");
    }
    const file = await req.file();
    if (!file) {
      throw new AppError("NO_FILE_UPLOADED");
    }
    const bytes = await file.toBuffer();
    const mime = mimeOf(bytes);
    if (!mime || bytes.length < 1 || bytes.length > 5 * 1024 * 1024) {
      throw new AppError("VALIDATION_ERROR");
    }
    const storageKey = randomUUID();
    const location = atlasStoragePath(storageKey);
    await fs.mkdir(path.dirname(location), { recursive: true, mode: 0o700 });
    await fs.writeFile(location, bytes, { flag: "wx", mode: 0o600 });
    try {
      const image = await app.prisma.atlasMedia.create({
        data: {
          entryId: id,
          storageKey,
          mime,
          size: bytes.length,
          filename:
            file.filename.replace(/[/\\\x00-\x1f]/g, "_").slice(0, 180) ||
            "imagem",
        },
      });
      return reply.code(201).send({ data: image });
    } catch (error) {
      await fs.unlink(location);
      throw error;
    }
  });

  app.get("/entries/:id/media/:mediaId", async (req, reply) => {
    const { id, mediaId } = parseInput(mediaIdSchema, req.params);
    const entry = await app.prisma.atlasEntry.findUnique({ where: { id } });
    if (!entry) {
      throw new AppError("NOT_FOUND");
    }
    allowViewing(req, entry);
    const image = await app.prisma.atlasMedia.findFirst({
      where: { id: mediaId, entryId: id },
    });
    if (!image) {
      throw new AppError("NOT_FOUND");
    }
    return reply
      .header("Cache-Control", "private, no-store")
      .header("X-Content-Type-Options", "nosniff")
      .header("Content-Security-Policy", "sandbox")
      .type(image.mime)
      .send(createReadStream(atlasStoragePath(image.storageKey)));
  });
};
