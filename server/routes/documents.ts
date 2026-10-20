import { createReadStream } from "node:fs";
import { WORKFLOW_TYPES } from "@shared/constants/workflow";
import { AppError } from "@shared/errors/app-error.js";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import { documentPath, storeDocument } from "../services/documents.service.js";
import { authorizeWorkflow } from "../services/workflow.service.js";
import { parseInput } from "../utils/parse-input.js";
import { getRole } from "../utils/request.js";

const target = z.object({
  entityType: z.enum(WORKFLOW_TYPES),
  entityId: z.string().min(1).max(100),
});
async function access(
  req: FastifyRequest,
  value: z.infer<typeof target>,
  edit = false
) {
  if (value.entityType === "GENERAL") {
    if (value.entityId !== "library") {
      throw new AppError("VALIDATION_ERROR");
    }
    const allowed = await req.server.auth.api.userHasPermission({
      body: { role: getRole(req), permissions: { settings: ["edit"] } },
    });
    if (!allowed.success) {
      throw new AppError("FORBIDDEN");
    }
    return;
  }
  await authorizeWorkflow(
    req,
    value.entityType,
    edit ? "edit" : "view",
    value.entityId
  );
}
export const documentsRoutes: FastifyPluginAsync = (app) => {
  app.get("/", async (req) => {
    const { cursor, ...value } = parseInput(
      target.extend({ cursor: z.string().optional() }),
      req.query
    );
    await access(req, value);
    const rows = await app.prisma.documentLink.findMany({
      where: value,
      include: {
        document: {
          select: { id: true, name: true, size: true, createdAt: true },
        },
      },
      orderBy: { id: "desc" },
      take: 200,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return {
      data: rows.map((row) => row.document),
      nextCursor: rows.length === 200 ? rows.at(-1)?.id : null,
    };
  });
  app.post("/", async (req, reply) => {
    const value = parseInput(target, req.query);
    await access(req, value, true);
    const file = await req.file();
    if (!file) {
      throw new AppError("NO_FILE_UPLOADED");
    }
    const bytes = await file.toBuffer();
    return reply.code(201).send({
      data: await storeDocument(
        app.prisma,
        file.filename,
        bytes,
        value.entityType,
        value.entityId
      ),
    });
  });
  app.get("/:id/download", async (req, reply) => {
    const value = parseInput(target, req.query);
    await access(req, value);
    const { id } = parseInput(z.object({ id: z.string() }), req.params);
    const link = await app.prisma.documentLink.findUnique({
      where: { documentId_entityType_entityId: { documentId: id, ...value } },
      include: { document: true },
    });
    if (!link) {
      throw new AppError("NOT_FOUND");
    }
    return reply
      .header(
        "Content-Disposition",
        `attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(link.document.name)}`
      )
      .header("X-Content-Type-Options", "nosniff")
      .header("Cache-Control", "private, no-store")
      .header("Content-Security-Policy", "sandbox")
      .type("application/octet-stream")
      .send(createReadStream(documentPath(link.document.storageKey)));
  });
  app.post("/:id/link", async (req) => {
    const { from, to } = parseInput(
      z.object({ from: target, to: target }),
      req.body
    );
    await access(req, from);
    await access(req, to, true);
    const { id } = parseInput(z.object({ id: z.string() }), req.params);
    if (
      !(await app.prisma.documentLink.findUnique({
        where: { documentId_entityType_entityId: { documentId: id, ...from } },
      }))
    ) {
      throw new AppError("NOT_FOUND");
    }
    return {
      data: await app.prisma.documentLink.upsert({
        where: { documentId_entityType_entityId: { documentId: id, ...to } },
        create: { documentId: id, ...to },
        update: {},
      }),
    };
  });
  app.delete("/:id/link", async (req, reply) => {
    const value = parseInput(target, req.query);
    await access(req, value, true);
    const { id } = parseInput(z.object({ id: z.string() }), req.params);
    // Unlink only: immutable bytes remain for backup/recovery and other records.
    await app.prisma.documentLink.deleteMany({
      where: { documentId: id, ...value },
    });
    return reply.code(204).send();
  });
  return Promise.resolve();
};
