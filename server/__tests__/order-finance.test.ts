import { Prisma, type PrismaClient } from "@generated/client";
import { isAppError } from "@shared/errors/app-error";
import { orderPaymentFields } from "@shared/schemas/order-finance";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { orderFinanceRoutes } from "../routes/order-finance";
import {
  recordOrderPayment,
  setOrderQuote,
  voidOrderPayment,
} from "../services/order-finance.service";

const version = "2026-10-23T10:00:00.000Z";
const input = {
  method: "MB_WAY" as const,
  amount: 25,
  requestKey: "12345678-1234-4123-8123-123456789abc",
  expectedUpdatedAt: version,
};
function setup() {
  const order = {
    id: "o1",
    quoteStatus: "ACCEPTED",
    quoteGross: new Prisma.Decimal(100),
    title: "Order",
    updatedAt: new Date(version),
    lines: [
      {
        name: "Part",
        quoteGross: new Prisma.Decimal(30),
        quantity: 2,
        saleVatRate: new Prisma.Decimal(23),
      },
    ],
  };
  let payment: {
    id: string;
    orderId: string;
    method: string;
    amount: Prisma.Decimal;
    voidedAt: Date | null;
    reference?: string;
    note?: string;
  } | null = null;
  const tx = {
    $queryRaw: vi.fn(async () => [{ id: "o1" }]),
    purchaseOrder: {
      findUnique: vi.fn(async () => order),
      update: vi.fn(async ({ data }) => Object.assign(order, data)),
    },
    orderPayment: {
      findMany: vi.fn(async () => []),
      aggregate: vi.fn(async () => ({
        _sum: { amount: payment && !payment.voidedAt ? payment.amount : null },
      })),
      findUnique: vi.fn(async () => payment),
      findFirst: vi.fn(async () => payment),
      create: vi.fn(({ data }) => {
        payment = {
          ...data,
          id: "p1",
          amount: new Prisma.Decimal(data.amount),
          voidedAt: null,
        };
        return Promise.resolve(payment);
      }),
      update: vi.fn(async ({ data }) => Object.assign(payment ?? {}, data)),
    },
    auditLog: {
      findMany: vi.fn(async () => []),
      create: vi.fn(async () => ({})),
    },
  };
  const db = {
    ...tx,
    $transaction: async (run: (client: unknown) => unknown) => await run(tx),
  } as unknown as PrismaClient;
  return { db, tx, order };
}
describe("order quote and payments", () => {
  it("records a partial payment once, including an identical retry after the version changes", async () => {
    const { db, tx } = setup();
    await recordOrderPayment(db, "o1", input, "u1");
    await recordOrderPayment(db, "o1", input, "u1");
    expect(tx.orderPayment.create).toHaveBeenCalledTimes(1);
    expect(tx.orderPayment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ method: "MB_WAY", amount: 25 }),
    });
    await expect(
      recordOrderPayment(db, "o1", { ...input, amount: 26 }, "u1")
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("uses the actual line quote instead of a stale header and blocks overpayment", async () => {
    const { db, tx } = setup();
    await expect(
      recordOrderPayment(db, "o1", { ...input, amount: 61 }, "u1")
    ).rejects.toMatchObject({
      code: "PAYMENT_EXCEEDS_BALANCE",
      details: { balanceDue: 60 },
    });
    expect(tx.orderPayment.create).not.toHaveBeenCalled();
  });
  it("rejects a stale version or an unaccepted quote", async () => {
    const { db, order } = setup();
    await expect(
      recordOrderPayment(
        db,
        "o1",
        { ...input, expectedUpdatedAt: "2026-10-22T10:00:00.000Z" },
        "u1"
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
    order.quoteStatus = "DRAFT";
    await expect(
      recordOrderPayment(db, "o1", input, "u1")
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("retains a corrected payment with its reason and prevents a repeated void", async () => {
    const { db, tx } = setup();
    await recordOrderPayment(db, "o1", input, "u1");
    await voidOrderPayment(db, "o1", "p1", "Wrong amount", "u1");
    await voidOrderPayment(db, "o1", "p1", "Wrong amount", "u1");
    expect(tx.orderPayment.update).toHaveBeenCalledTimes(1);
    expect(tx.orderPayment.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: expect.objectContaining({
        voidedAt: expect.any(Date),
        voidReason: "Wrong amount",
      }),
    });
  });
  it("retains quote line snapshots in the audit trail and will not reject a quote with active receipts", async () => {
    const { db, tx, order } = setup();
    await setOrderQuote(
      db,
      "o1",
      { status: "ACCEPTED", expectedUpdatedAt: version },
      "u1"
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            total: "60",
            lines: expect.any(Array),
          }),
        }),
      })
    );
    await recordOrderPayment(
      db,
      "o1",
      { ...input, expectedUpdatedAt: order.updatedAt.toISOString() },
      "u1"
    );
    await expect(
      setOrderQuote(
        db,
        "o1",
        {
          status: "REJECTED",
          expectedUpdatedAt: order.updatedAt.toISOString(),
        },
        "u1"
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("only accepts positive amounts with cent precision", () => {
    for (const amount of [0, -1, 1.001]) {
      expect(orderPaymentFields.safeParse({ ...input, amount }).success).toBe(
        false
      );
    }
    expect(
      orderPaymentFields.safeParse({ ...input, amount: 1.23 }).success
    ).toBe(true);
  });
  it("enforces financial access and create permissions on the server", async () => {
    const { db, tx } = setup();
    let view = true;
    const app = Fastify();
    app.decorate("prisma", db);
    app.decorate("auth", {
      api: {
        userHasPermission: async ({
          body,
        }: {
          body: { permissions: { payments?: string[] } };
        }) => ({
          success:
            !body.permissions.payments?.includes("create") &&
            (view || !body.permissions.payments?.includes("view")),
        }),
      },
    } as never);
    app.addHook("onRequest", (req, _reply, done) => {
      req.user = { id: "u1", role: "TECHNICIAN" } as never;
      done();
    });
    app.setErrorHandler((error, _req, reply) =>
      reply.code(isAppError(error) ? error.status : 500).send({})
    );
    app.register(orderFinanceRoutes, { prefix: "/orders" });
    const response = await app.inject({
      url: "/orders/o1/payments",
      method: "POST",
      payload: input,
    });
    expect(response.statusCode).toBe(403);
    expect(tx.orderPayment.create).not.toHaveBeenCalled();
    const visible = await app.inject({ url: "/orders/o1/finance" });
    expect(visible.statusCode).toBe(200);
    expect(visible.json().data).toMatchObject({
      total: "60.00",
      paid: "0.00",
      balance: "60.00",
      quotes: [],
    });
    tx.purchaseOrder.findUnique.mockClear();
    view = false;
    const hidden = await app.inject({ url: "/orders/o1/finance" });
    expect(hidden.statusCode).toBe(403);
    expect(tx.purchaseOrder.findUnique).not.toHaveBeenCalled();
    await app.close();
  });
});
