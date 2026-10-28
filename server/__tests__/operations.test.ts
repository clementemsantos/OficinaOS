import { isAppError } from "@shared/errors/app-error";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { operationsRoutes } from "../routes/operations";

function build(allowed = true) {
  const query = vi.fn(async (_sql: unknown) => [] as { id: string }[]);
  const app = Fastify();
  app.decorate("prisma", { $queryRaw: query } as never);
  app.decorate("auth", {
    api: { userHasPermission: async () => ({ success: allowed }) },
  } as never);
  app.addHook("onRequest", (req, _reply, done) => {
    req.user = { id: "owner", role: allowed ? "OWNER" : "TECHNICIAN" } as never;
    done();
  });
  app.setErrorHandler((error, _req, reply) =>
    reply.code(isAppError(error) ? error.status : 500).send({ error: true })
  );
  app.register(operationsRoutes);
  return { app, query };
}

describe("shop operations", () => {
  it("denies access before querying customer-wide reports", async () => {
    const { app, query } = build(false);
    for (const url of ["/retention", "/warranties"]) {
      expect((await app.inject({ url })).statusCode).toBe(403);
    }
    expect(query).not.toHaveBeenCalled();
    await app.close();
  });
  it("validates day bounds, warranty states and cursor length", async () => {
    const { app, query } = build();
    for (const url of [
      "/retention?days=0",
      "/retention?days=3651",
      "/warranties?state=oops",
      `/retention?cursor=${"x".repeat(101)}`,
    ]) {
      expect((await app.inject({ url })).statusCode).toBe(400);
    }
    expect(query).not.toHaveBeenCalled();
    await app.close();
  });
  it("parameterizes search and cursor values instead of interpolating SQL", async () => {
    const { app, query } = build();
    const search = "O'Brien_%'; DROP TABLE customers; --";
    const response = await app.inject({
      url: `/retention?q=${encodeURIComponent(search)}&cursor=page1`,
    });
    expect(response.statusCode).toBe(200);
    const sql = query.mock.calls[0][0] as unknown as {
      text: string;
      values: unknown[];
    };
    expect(sql.text).not.toContain(search);
    expect(sql.values).toContain(search);
    expect(sql.values).toContain("page1");
    expect(sql.text).toContain("NOT EXISTS");
    await app.close();
  });
  it("returns exactly 50 rows with a cursor only when more data exists", async () => {
    const { app, query } = build();
    query.mockResolvedValueOnce(
      Array.from({ length: 51 }, (_, i) => ({ id: `id${i}` }))
    );
    const response = await app.inject({ url: "/warranties?state=UNKNOWN" });
    expect(response.json().data).toHaveLength(50);
    expect(response.json().nextCursor).toBe("id49");
    const sql = query.mock.calls[0][0] as unknown as { text: string };
    expect(sql.text).toContain('"expiresAt" IS NULL');
    expect(
      (await app.inject({ url: "/warranties" })).json().nextCursor
    ).toBeNull();
    await app.close();
  });
});
