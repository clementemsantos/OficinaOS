import { isAppError } from "@shared/errors/app-error.js";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { catalogCategoriesRoutes } from "../routes/catalog-categories.js";

function build({ manage = false, admin = false } = {}) {
  const prisma = {
    catalogCategory: { findMany: vi.fn(async () => []), create: vi.fn() },
    $transaction: vi.fn(),
  };
  const app = Fastify();
  app.decorate("prisma", prisma as never);
  app.decorate("auth", {
    api: {
      userHasPermission: ({
        body,
      }: {
        body: { permissions: { parts?: string[]; settings?: string[] } };
      }) =>
        Promise.resolve({
          success: !(
            (body.permissions.parts?.includes("manageCatalog") && !manage) ||
            (body.permissions.settings && !admin)
          ),
        }),
    },
  } as never);
  app.addHook("onRequest", (req, _reply, done) => {
    req.user = { id: "u1", role: "TECHNICIAN" } as never;
    done();
  });
  app.setErrorHandler((error, _req, reply) =>
    reply
      .status(isAppError(error) ? error.status : 500)
      .send({ code: isAppError(error) ? error.code : "INTERNAL_ERROR" })
  );
  app.register(catalogCategoriesRoutes);
  return { app, prisma };
}
describe("category module permissions", () => {
  it("allows catalog readers to list categories", async () => {
    const { app } = build();
    expect((await app.inject({ url: "/?scope=PART" })).statusCode).toBe(200);
    await app.close();
  });
  it("denies category creation without management permission", async () => {
    const { app, prisma } = build();
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/",
          payload: { scope: "PART", name: "Screens" },
        })
      ).statusCode
    ).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    await app.close();
  });
  it("does not allow a parts manager to configure ticket categories", async () => {
    const { app, prisma } = build({ manage: true });
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/",
          payload: { scope: "TICKET", name: "Websites" },
        })
      ).statusCode
    ).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    await app.close();
  });
  it("rejects unsupported scopes before a database write", async () => {
    const { app, prisma } = build({ manage: true });
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/",
          payload: { scope: "ANYTHING", name: "New" },
        })
      ).statusCode
    ).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    await app.close();
  });
});
