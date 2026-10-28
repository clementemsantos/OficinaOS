import type { PrismaClient } from "@generated/client";
import {
  createOrderFields,
  updateOrderFields,
} from "@shared/schemas/order-lines";
import { describe, expect, it, vi } from "vitest";
import { createOrder, updateOrder } from "../purchase-orders.service";

const base = {
  name: "Product",
  quantity: 2,
  reference: "",
  partId: null,
  supplierId: null,
  purchaseUrl: "",
  costGross: "123",
  quoteGross: "246",
  costVatRate: "23",
  saleVatRate: "23",
  recoverInputVat: true,
};
function setup() {
  const existing = {
    id: "o1",
    title: "Original",
    kind: "PRODUCT",
    partId: null,
    costGross: "246",
    quoteGross: "492",
    costVatRate: "0",
    saleVatRate: "0",
    recoverInputVat: true,
    updatedAt: new Date("2026-10-20T12:00:00Z"),
    lines: [
      {
        ...base,
        id: "l1",
        orderId: "o1",
        position: 0,
        part: null,
        supplier: null,
      },
    ],
  };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "o1" }]),
    supplier: { findUnique: vi.fn().mockResolvedValue({ id: "s1" }) },
    partsCatalog: { findUnique: vi.fn().mockResolvedValue({ id: "p1" }) },
    customer: { findUnique: vi.fn().mockResolvedValue({ id: "c1" }) },
    job: { findUnique: vi.fn().mockResolvedValue({ id: "j1" }) },
    orderPayment: {
      aggregate: vi.fn(async () => ({ _sum: { amount: null } })),
    },
    purchaseOrder: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(existing),
      create: vi
        .fn()
        .mockImplementation(({ data }) => ({ id: "new", ...data })),
      update: vi.fn().mockImplementation(({ data }) => ({ id: "o1", ...data })),
    },
  };
  const db = { ...tx, $transaction: vi.fn(async (run) => await run(tx)) };
  return { db, tx, existing, prisma: db as unknown as PrismaClient };
}
describe("purchase orders with multiple products", () => {
  it("accepts mixed parts and products while preserving line links, quantities and totals", async () => {
    const { prisma, tx } = setup();
    await createOrder(
      prisma,
      createOrderFields.parse({
        title: "Screen and laptop",
        kind: "MIXED",
        partId: "p1",
        lines: [
          { ...base, name: "Screen", partId: "p1", quantity: 1 },
          { ...base, name: "Laptop", partId: "p2", quantity: 2 },
        ],
      })
    );
    const data = tx.purchaseOrder.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      kind: "MIXED",
      partId: "p1",
      costGross: "369.00",
      quoteGross: "738.00",
    });
    expect(data.lines.create).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Screen", partId: "p1", quantity: 1 }),
        expect.objectContaining({ name: "Laptop", partId: "p2", quantity: 2 }),
      ])
    );
  });
  it("does not let a changed quote fall below payments already received", async () => {
    const { prisma, tx, existing } = setup();
    tx.orderPayment.aggregate.mockResolvedValue({
      _sum: { amount: "100" },
    } as never);
    await expect(
      updateOrder(
        prisma,
        "o1",
        updateOrderFields.parse({
          expectedUpdatedAt: existing.updatedAt.toISOString(),
          lines: [{ ...base, id: "l1", quantity: 1, quoteGross: "50" }],
        }),
        ["lines", "expectedUpdatedAt"]
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(tx.purchaseOrder.update).not.toHaveBeenCalled();
  });
  it("returns a revised customer quote to draft without changing payment records", async () => {
    const { prisma, tx, existing } = setup();
    await updateOrder(
      prisma,
      "o1",
      updateOrderFields.parse({
        expectedUpdatedAt: existing.updatedAt.toISOString(),
        lines: [{ ...base, id: "l1", quoteGross: "300" }],
      }),
      ["lines", "expectedUpdatedAt"]
    );
    expect(tx.purchaseOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quoteStatus: "DRAFT",
          quoteDecidedAt: null,
          quoteGross: "600.00",
        }),
      })
    );
  });

  it("creates all lines and computes header totals instead of trusting client totals", async () => {
    const { prisma, tx } = setup();
    await createOrder(
      prisma,
      createOrderFields.parse({
        title: "New",
        costGross: "1",
        quoteGross: "1",
        lines: [base, { ...base, name: "Other", quantity: 1 }],
      })
    );
    expect(tx.purchaseOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          costGross: "369.00",
          quoteGross: "738.00",
          lines: {
            create: [
              expect.objectContaining({
                name: "Product",
                quantity: 2,
                position: 0,
              }),
              expect.objectContaining({ name: "Other", position: 1 }),
            ],
          },
        }),
      })
    );
  });
  it("retains compatibility with legacy single-item creation", async () => {
    const { prisma, tx } = setup();
    await createOrder(
      prisma,
      createOrderFields.parse({
        title: "Old caller",
        costGross: "10",
        quoteGross: "20",
      })
    );
    expect(
      tx.purchaseOrder.create.mock.calls[0][0].data.lines.create[0]
    ).toMatchObject({
      name: "Old caller",
      quantity: 1,
      costGross: "10",
      quoteGross: "20",
    });
  });
  it("preserves line IDs, scopes deletes to the order and recalculates after editing and adding rows", async () => {
    const { prisma, tx, existing } = setup();
    const input = updateOrderFields.parse({
      lines: [
        { ...base, id: "l1", quantity: 3 },
        { ...base, name: "Added", quantity: 1 },
      ],
      expectedUpdatedAt: existing.updatedAt.toISOString(),
    });
    await updateOrder(prisma, "o1", input, Object.keys(input));
    const data = tx.purchaseOrder.update.mock.calls[0][0].data;
    expect(data.costGross).toBe("492.00");
    expect(data.quoteGross).toBe("984.00");
    expect(data.lines.deleteMany).toEqual({ id: { notIn: ["l1"] } });
    expect(data.lines.update[0]).toMatchObject({
      where: { id: "l1" },
      data: { quantity: 3 },
    });
    expect(data.lines.update[0].data).not.toHaveProperty("id");
    expect(data.lines.create).toHaveLength(1);
    expect(data.updatedAt.getTime()).toBeGreaterThan(
      existing.updatedAt.getTime()
    );
  });
  it("preserves all quantities and amounts on a metadata-only update", async () => {
    const { prisma, tx } = setup();
    await updateOrder(
      prisma,
      "o1",
      updateOrderFields.parse({ title: "Renamed" }),
      ["title"]
    );
    const data = tx.purchaseOrder.update.mock.calls[0][0].data;
    expect(data).toMatchObject({
      title: "Renamed",
      costGross: "246.00",
      quoteGross: "492.00",
    });
    expect(data.lines.update[0].data.quantity).toBe(2);
  });
  it("removes an omitted line and adds its replacement without altering stock", async () => {
    const { prisma, tx, existing } = setup();
    const input = updateOrderFields.parse({
      lines: [{ ...base, partId: "p1", quantity: 1 }],
      expectedUpdatedAt: existing.updatedAt.toISOString(),
    });
    await updateOrder(prisma, "o1", input, Object.keys(input));
    expect(tx.purchaseOrder.update.mock.calls[0][0].data.lines).toMatchObject({
      deleteMany: { id: { notIn: [] } },
      update: [],
      create: [expect.objectContaining({ partId: "p1" })],
    });
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.$queryRaw.mock.calls[0][0].join("?")).toContain("FOR UPDATE");
  });
  it("rejects stale edits before any write", async () => {
    const { prisma, tx } = setup();
    const input = updateOrderFields.parse({
      lines: [base],
      expectedUpdatedAt: "2026-10-19T12:00:00Z",
    });
    await expect(
      updateOrder(prisma, "o1", input, Object.keys(input))
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(tx.purchaseOrder.update).not.toHaveBeenCalled();
  });
  it("rejects IDs belonging to another order", async () => {
    const { prisma, tx, existing } = setup();
    const input = updateOrderFields.parse({
      lines: [{ ...base, id: "foreign" }],
      expectedUpdatedAt: existing.updatedAt.toISOString(),
    });
    await expect(
      updateOrder(prisma, "o1", input, Object.keys(input))
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(tx.purchaseOrder.update).not.toHaveBeenCalled();
  });
  it.each([
    "supplier",
    "partsCatalog",
  ] as const)("rejects a missing %s reference", async (model) => {
    const { prisma, tx } = setup();
    tx[model].findUnique.mockResolvedValue(null);
    await expect(
      createOrder(
        prisma,
        createOrderFields.parse({
          title: "New",
          lines: [{ ...base, supplierId: "s1", partId: "p1" }],
        })
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(tx.purchaseOrder.create).not.toHaveBeenCalled();
  });
  it("rejects line IDs on new order creation", async () => {
    const { prisma } = setup();
    await expect(
      createOrder(
        prisma,
        createOrderFields.parse({
          title: "New",
          lines: [{ ...base, id: "existing" }],
        })
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
