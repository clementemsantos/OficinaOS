import { Prisma } from "@generated/client";
import { isAppError } from "@shared/errors/app-error";
import { campaignFields, campaignUpdate } from "@shared/schemas/marketing";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { marketingRoutes } from "../routes/marketing";

const campaign = {
  name: "Christmas",
  channel: "GOOGLE_ADS",
  status: "DRAFT",
  objective: "Repair enquiries",
  budget: "200",
  spend: "100",
  landingUrl: "https://inove.pt/",
  startDate: null,
  endDate: null,
};
function build(admin = true) {
  const db = {
    marketingCampaign: {
      findMany: vi.fn(async () => [
        { ...campaign, id: "c1", spend: new Prisma.Decimal(100) },
      ]),
      create: vi.fn(async ({ data }) => ({ id: "c1", ...data })),
      updateMany: vi.fn(async () => ({ count: 1 })),
      findUnique: vi.fn(async () => ({ id: "c1" })),
    },
    marketingLead: {
      groupBy: vi.fn(async () => [
        {
          campaignId: "c1",
          stage: "WON",
          _count: { _all: 10 },
          _sum: { value: new Prisma.Decimal(400) },
        },
        {
          campaignId: "c1",
          stage: "NEW",
          _count: { _all: 190 },
          _sum: { value: new Prisma.Decimal(0) },
        },
      ]),
      findMany: vi.fn(async () => []),
      create: vi.fn(async ({ data }) => ({ id: "l1", ...data })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    customer: { findUnique: vi.fn(async () => ({ id: "customer1" })) },
    auditLog: { create: vi.fn(async () => ({})) },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(async (run) => await run(db));
  const app = Fastify();
  app.decorate("prisma", db as never);
  app.decorate("auth", {
    api: { userHasPermission: async () => ({ success: admin }) },
  } as never);
  app.addHook("onRequest", (req, _reply, done) => {
    req.user = { id: "u1", role: admin ? "OWNER" : "TECHNICIAN" } as never;
    req.locale = "en";
    done();
  });
  app.setErrorHandler((error, _req, reply) =>
    reply
      .code(isAppError(error) ? error.status : 500)
      .send({ code: isAppError(error) ? error.code : "INTERNAL_ERROR" })
  );
  app.register(marketingRoutes, { prefix: "/marketing" });
  return { app, db };
}
describe("local CRM and marketing", () => {
  it("restricts campaign data and mutations to administrators", async () => {
    const { app, db } = build(false);
    expect((await app.inject({ url: "/marketing/campaigns" })).statusCode).toBe(
      403
    );
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/marketing/campaigns",
          payload: campaign,
        })
      ).statusCode
    ).toBe(403);
    expect(db.marketingCampaign.findMany).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
    await app.close();
  });
  it("uses all related opportunities for metrics rather than only a loaded page", async () => {
    const { app } = build();
    const res = await app.inject({ url: "/marketing/campaigns" });
    expect(res.statusCode).toBe(200);
    expect(res.json().data[0]).toMatchObject({
      leadCount: 200,
      wonCount: 10,
      costPerLead: "0.50",
      estimatedRevenue: "400.00",
      estimatedRoas: "4.00",
    });
    await app.close();
  });
  it("accepts a complete versioned campaign update and rejects stale edits without an audit side effect", async () => {
    const { app, db } = build();
    const payload = {
      ...campaign,
      expectedUpdatedAt: "2026-10-24T10:00:00.000Z",
    };
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: "/marketing/campaigns/c1",
          payload,
        })
      ).statusCode
    ).toBe(200);
    db.auditLog.create.mockClear();
    db.marketingCampaign.updateMany.mockResolvedValue({ count: 0 });
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: "/marketing/campaigns/c1",
          payload,
        })
      ).statusCode
    ).toBe(409);
    expect(db.auditLog.create).not.toHaveBeenCalled();
    await app.close();
  });
  it("links an opportunity to existing customer and campaign records without creating another customer", async () => {
    const { app, db } = build();
    const payload = {
      title: "Laptop order",
      customerId: "customer1",
      campaignId: "c1",
      stage: "QUALIFIED",
      value: "100",
      followUpDate: "2026-10-26",
      notes: "Follow up",
    };
    const res = await app.inject({
      method: "POST",
      url: "/marketing/leads",
      payload,
    });
    expect(res.statusCode).toBe(201);
    expect(db.customer.findUnique).toHaveBeenCalledWith({
      where: { id: "customer1" },
      select: { id: true },
    });
    expect(db.marketingLead.create).toHaveBeenCalledWith({ data: payload });
    db.customer.findUnique.mockResolvedValue(null as never);
    expect(
      (await app.inject({ method: "POST", url: "/marketing/leads", payload }))
        .statusCode
    ).toBe(404);
    await app.close();
  });
  it("validates dates, prices and safe landing URLs", () => {
    expect(
      campaignFields.safeParse({
        ...campaign,
        startDate: "2026-10-30",
        endDate: "2026-10-01",
      }).success
    ).toBe(false);
    expect(campaignFields.safeParse({ ...campaign, spend: "-1" }).success).toBe(
      false
    );
    expect(
      campaignFields.safeParse({
        ...campaign,
        landingUrl: "javascript:alert(1)",
      }).success
    ).toBe(false);
    expect(
      campaignUpdate.safeParse({
        ...campaign,
        expectedUpdatedAt: "2026-10-24T10:00:00Z",
      }).success
    ).toBe(true);
  });
});
