import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import staticPlugin from "@fastify/static";
import { isAppError } from "@shared/errors/app-error.js";
import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { documentsRoutes } from "../routes/documents.js";
import { documentName, documentPath } from "../services/documents.service.js";

let root = "";
vi.mock("../config/env.js", () => ({ loadEnv: () => ({ UPLOAD_DIR: root }) }));
beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "oficina-documents-"));
  await fs.mkdir(path.join(root, ".documents"));
  await fs.writeFile(
    path.join(root, ".documents", "secret"),
    "private invoice"
  );
});
afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true });
});
function appFor({ admin = true, visibleReturn = false } = {}) {
  const app = Fastify();
  const prisma = {
    documentLink: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    job: { findUnique: vi.fn(async () => ({ id: "job1" })) },
    returnClaim: {
      findUnique: vi.fn(async () => ({ id: "claim" })),
      findFirst: vi.fn(async () => (visibleReturn ? { id: "claim" } : null)),
    },
  };
  app.decorate("prisma", prisma as never);
  app.decorate("auth", {
    api: {
      userHasPermission: ({
        body,
      }: {
        body: { permissions: { settings?: string[]; returns?: string[] } };
      }) =>
        Promise.resolve({
          success: body.permissions.settings
            ? admin
            : !body.permissions.returns?.includes("viewShop"),
        }),
    },
  } as never);
  app.addHook("onRequest", (req, _reply, done) => {
    req.user = { id: "staff1", role: "TECHNICIAN" } as never;
    done();
  });
  app.setErrorHandler((error, _req, reply) => {
    reply
      .code(isAppError(error) ? error.status : 500)
      .send({ code: isAppError(error) ? error.code : "INTERNAL_ERROR" });
  });
  app.register(documentsRoutes, { prefix: "/documents" });
  app.register(staticPlugin, { root, prefix: "/uploads/", dotfiles: "deny" });
  return { app, prisma };
}
describe("private documents", () => {
  it("does not serve private storage via static uploads, including encoded paths", async () => {
    const { app } = appFor();
    for (const url of [
      "/uploads/.documents/secret",
      "/uploads/%2edocuments/secret",
      "/uploads/%2Edocuments%2Fsecret",
    ]) {
      const res = await app.inject({ url });
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
      expect(res.body).not.toContain("private invoice");
    }
    await app.close();
  });
  it("requires administrative access to the shared file library", async () => {
    const { app, prisma } = appFor({ admin: false });
    const res = await app.inject({
      url: "/documents?entityType=GENERAL&entityId=library",
    });
    expect(res.statusCode).toBe(403);
    expect(prisma.documentLink.findMany).not.toHaveBeenCalled();
    await app.close();
  });
  it("keeps return-claim self scope on attachments", async () => {
    const { app, prisma } = appFor();
    const res = await app.inject({
      url: "/documents?entityType=RETURN&entityId=claim",
    });
    expect(res.statusCode).toBe(404);
    expect(prisma.documentLink.findMany).not.toHaveBeenCalled();
    await app.close();
  });
  it("cannot download a document belonging to a different record", async () => {
    const { app, prisma } = appFor();
    const res = await app.inject({
      url: "/documents/invoice/download?entityType=JOB&entityId=job1",
    });
    expect(res.statusCode).toBe(404);
    expect(prisma.documentLink.findUnique).toHaveBeenCalledWith({
      where: {
        documentId_entityType_entityId: {
          documentId: "invoice",
          entityType: "JOB",
          entityId: "job1",
        },
      },
      include: { document: true },
    });
    await app.close();
  });
  it("rejects storage traversal and strips unsafe download names", () => {
    expect(() => documentPath("../../.env")).toThrow();
    expect(documentName("../../invoice\r\n.pdf")).toBe(".._.._invoice__.pdf");
  });
});
