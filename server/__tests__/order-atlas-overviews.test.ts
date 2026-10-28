import type { Prisma } from "@generated/client";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { atlasCasesRoutes } from "../routes/atlas-cases.js";
import { purchaseOrdersRoutes } from "../routes/purchase-orders.js";

function build() {
  const db = {
    purchaseOrder: {
      findMany: vi.fn(async (_args: Prisma.PurchaseOrderFindManyArgs) => [
        { id: "o1", title: "Laptop", lines: [] },
      ]),
    },
    supplier: {
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
    },
    customer: { findMany: vi.fn(async () => []) },
    workflowState: {
      findMany: vi.fn(async () => [{ id: "s1", name: "Waiting" }]),
    },
    recordWorkflow: {
      findMany: vi.fn(async (args: Prisma.RecordWorkflowFindManyArgs) =>
        args.include
          ? [{ entityId: "o1", state: { id: "s1", name: "Waiting" } }]
          : [{ entityId: "o1" }]
      ),
    },
    job: { findMany: vi.fn(async (_args: Prisma.JobFindManyArgs) => []) },
  };
  const app = Fastify();
  app.decorate("prisma", db as never);
  app.decorate("auth", {
    api: {
      userHasPermission: async ({
        body,
      }: {
        body: { permissions: { parts?: string[] } };
      }) => ({ success: !body.permissions.parts?.includes("viewCost") }),
    },
  } as never);
  app.addHook("onRequest", (req, _reply, done) => {
    req.user = { id: "u", role: "TECHNICIAN" } as never;
    req.locale = "en";
    done();
  });
  app.register(purchaseOrdersRoutes, { prefix: "/orders" });
  app.register(atlasCasesRoutes, { prefix: "/atlas" });
  return { app, db };
}
describe("order and repair case overviews", () => {
  it("supports the mixed-order filter before pagination", async () => {
    const { app, db } = build();
    expect((await app.inject({ url: "/orders?kind=MIXED" })).statusCode).toBe(
      200
    );
    expect(db.purchaseOrder.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { kind: "MIXED" },
    });
    await app.close();
  });
  it("combines state and text search before pagination, returning state without financial access", async () => {
    const { app, db } = build();
    const res = await app.inject({
      url: "/orders?q=EN-000042&stateId=s1&kind=PART&from=2026-10-01&to=2026-10-23",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data[0].workflowState.name).toBe("Waiting");
    expect(res.json().data[0]).not.toHaveProperty("costGross");
    const args = db.purchaseOrder.findMany.mock.calls[0]?.[0];
    expect(args).toMatchObject({
      where: {
        kind: "PART",
        AND: [
          {
            createdAt: {
              gte: new Date("2026-10-01Z"),
              lt: new Date("2026-10-24Z"),
            },
            AND: [{ OR: expect.arrayContaining([{ number: 42 }]) }],
          },
          { AND: [{ id: { in: ["o1"] } }] },
        ],
      },
      take: 100,
    });
    await app.close();
  });
  it("filters orders with no assigned state by excluding existing workflow records", async () => {
    const { app, db } = build();
    await app.inject({ url: "/orders?stateId=none" });
    expect(db.purchaseOrder.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { AND: [{}, { AND: [{ id: { notIn: ["o1"] } }] }] },
    });
    await app.close();
  });
  it("queries real recorded interventions without selecting customer, credentials or prices", async () => {
    const { app, db } = build();
    const res = await app.inject({
      url: "/atlas/cases?q=Samsung&completed=true",
    });
    expect(res.statusCode).toBe(200);
    expect(db.job.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { status: { in: ["DONE", "DELIVERED"] }, OR: expect.any(Array) },
      take: 50,
    });
    const selected = db.job.findMany.mock.calls[0]?.[0]?.select;
    expect(selected).not.toHaveProperty("customer");
    expect(selected).not.toHaveProperty("deviceUnlockCode");
    expect(selected).not.toHaveProperty("accessCode");
    expect(selected).not.toHaveProperty("estimatedCost");
    await app.close();
  });
});
