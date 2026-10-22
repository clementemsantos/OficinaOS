import { isAppError } from "@shared/errors/app-error.js";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { rmaDeductionRoutes } from "../routes/rma-deductions.js";
import { supplierRmasRoutes } from "../routes/suppliers.js";

function build({ viewCost = true, sourceEdit = false } = {}) {
  const db = {
    $transaction: vi.fn(),
    supplierRma: {
      findMany: vi.fn(async () => [{ id: "rma1", deductedAmount: "20.00" }]),
    },
  };
  const app = Fastify();
  app.decorate("prisma", db as never);
  app.decorate("auth", {
    api: {
      userHasPermission: ({
        body,
      }: {
        body: {
          permissions: { parts?: string[]; jobs?: string[]; sales?: string[] };
        };
      }) =>
        Promise.resolve({
          success: !(
            (body.permissions.parts?.includes("viewCost") && !viewCost) ||
            ((body.permissions.jobs || body.permissions.sales) && !sourceEdit)
          ),
        }),
    },
  } as never);
  app.addHook("onRequest", (req, _reply, done) => {
    req.user = { id: "staff1", role: "OWNER" } as never;
    req.locale = "en";
    done();
  });
  app.setErrorHandler((error, _req, reply) => {
    reply
      .code(isAppError(error) ? error.status : 500)
      .send({ code: isAppError(error) ? error.code : "INTERNAL_ERROR" });
  });
  app.register(rmaDeductionRoutes, { prefix: "/api/supplier-rmas" });
  app.register(supplierRmasRoutes, { prefix: "/api/supplier-rmas" });
  return { app, db };
}
describe("RMA monetary permissions", () => {
  it("does not expose deducted values to catalog-only readers", async () => {
    const { app } = build({ viewCost: false });
    const res = await app.inject({ url: "/api/supplier-rmas" });
    expect(res.statusCode).toBe(200);
    expect(res.json().data[0]).not.toHaveProperty("deductedAmount");
    await app.close();
  });
  it.each([
    "JOB",
    "SALE",
  ])("does not let catalog management alone modify a %s", async (kind) => {
    const { app, db } = build();
    const res = await app.inject({
      method: "POST",
      url: "/api/supplier-rmas/rma1/deduct-piece",
      payload: {
        kind,
        reference: "record1",
        lineId: "line1",
        expectedUpdatedAt: "2026-10-22T10:00:00Z",
      },
    });
    expect(res.statusCode).toBe(403);
    expect(db.$transaction).not.toHaveBeenCalled();
    await app.close();
  });
  it("requires financial permission before returning priced candidate lines", async () => {
    const { app } = build({ viewCost: false, sourceEdit: true });
    const res = await app.inject({
      url: "/api/supplier-rmas/rma1/deduction-candidates?kind=JOB&reference=2026%2F1",
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});
