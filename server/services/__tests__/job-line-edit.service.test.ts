import { Prisma } from "@generated/client";
import { describe, expect, it, vi } from "vitest";
import { editJobPart, editJobRepair } from "../job-line-edit.service.js";

vi.mock("../audit.service.js", () => ({
  createAuditLog: vi.fn(async () => undefined),
}));
vi.mock("../storefront.service.js", () => ({
  markStoreDirtyIfListed: vi.fn(async () => undefined),
}));
function build({ status = "IN_REPAIR", stock = 5, missing = false } = {}) {
  let balance = stock;
  const line = {
    id: "line1",
    jobId: "j1",
    partId: "p1",
    partName: "Screen",
    quantity: 2,
    unitPrice: new Prisma.Decimal(10),
    category: "SCREEN",
    customCategoryId: null,
  };
  const tx = {
    $queryRaw: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join("?");
      if (sql.includes('SELECT "status"')) {
        return [{ status }];
      }
      if (sql.startsWith('UPDATE "parts_catalog"')) {
        const delta = Number(values[0]);
        if (balance - delta < 0) {
          return [];
        }
        balance -= delta;
        return [{ stockQuantity: balance }];
      }
      return [{ id: "line1" }];
    }),
    jobPart: {
      findFirst: vi.fn(async () => (missing ? null : line)),
      update: vi.fn(async ({ data }) => ({ ...line, ...data })),
    },
    jobRepair: {
      findFirst: vi.fn(async () =>
        missing
          ? null
          : {
              id: "r1",
              repairName: "Diagnostic",
              price: 20,
              customCategoryId: null,
            }
      ),
      update: vi.fn(async ({ data }) => ({ id: "r1", ...data })),
    },
    supplier: {
      findUnique: vi.fn(async () => ({
        id: "s1",
        name: "Vendor",
        isActive: true,
      })),
    },
    stockMovement: { create: vi.fn(async () => ({})) },
    catalogCategory: {
      findUnique: vi.fn(async () => ({ scope: "PART", isActive: true })),
    },
  };
  const prisma = {
    $transaction: vi.fn(
      async (fn: (value: typeof tx) => unknown) => await fn(tx)
    ),
  };
  return { prisma: prisma as never, tx, balance: () => balance };
}
describe("editing applied workshop lines", () => {
  it("updates the same line and consumes only the additional quantity", async () => {
    const { prisma, tx, balance } = build();
    const result = await editJobPart(
      prisma,
      "j1",
      "line1",
      { quantity: 4, unitPrice: 12 },
      "u1"
    );
    expect(result.id).toBe("line1");
    expect(result.totalCost.toString()).toBe("48");
    expect(balance()).toBe(3);
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        quantity: -2,
        type: "CONSUMPTION",
        balanceAfter: 3,
      }),
    });
  });
  it("returns stock when the applied quantity is reduced", async () => {
    const { prisma, tx, balance } = build();
    await editJobPart(prisma, "j1", "line1", { quantity: 1 }, "u1");
    expect(balance()).toBe(6);
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ quantity: 1, type: "RETURN" }),
    });
  });
  it("does not touch stock for name or price edits", async () => {
    const { prisma, tx } = build();
    await editJobPart(
      prisma,
      "j1",
      "line1",
      { partName: "Screen assembly", unitPrice: 15 },
      "u1"
    );
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
    expect(tx.jobPart.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ partName: "Screen assembly" }),
      })
    );
  });
  it("rejects stock shortages before updating the line", async () => {
    const { prisma, tx } = build({ stock: 0 });
    await expect(
      editJobPart(prisma, "j1", "line1", { quantity: 3 }, "u1")
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect(tx.jobPart.update).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });
  it("does not edit terminal repairs", async () => {
    const { prisma, tx } = build({ status: "DELIVERED" });
    await expect(
      editJobPart(prisma, "j1", "line1", { quantity: 3 }, "u1")
    ).rejects.toMatchObject({ code: "JOB_IN_TERMINAL_STATUS" });
    expect(tx.jobPart.update).not.toHaveBeenCalled();
  });
  it("scopes line lookup to its repair", async () => {
    const { prisma, tx } = build({ missing: true });
    await expect(
      editJobPart(prisma, "other-job", "line1", { quantity: 3 }, "u1")
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(tx.jobPart.findFirst).toHaveBeenCalledWith({
      where: { id: "line1", jobId: "other-job" },
    });
  });
  it("takes the supplier name from the linked supplier record", async () => {
    const { prisma } = build();
    expect(
      (
        await editJobPart(
          prisma,
          "j1",
          "line1",
          { supplierId: "s1", supplier: "Wrong vendor" },
          "u1"
        )
      ).supplier
    ).toBe("Vendor");
  });
  it("rejects a category belonging to a different module", async () => {
    const { prisma, tx } = build();
    tx.catalogCategory.findUnique.mockResolvedValue({
      scope: "REPAIR",
      isActive: true,
    });
    await expect(
      editJobPart(prisma, "j1", "line1", { customCategoryId: "wrong" }, "u1")
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(tx.jobPart.update).not.toHaveBeenCalled();
  });
  it("edits a service without deleting its original reference", async () => {
    const { prisma, tx } = build();
    await editJobRepair(
      prisma,
      "j1",
      "r1",
      { repairName: "Advanced diagnostic", price: 35 },
      "u1"
    );
    expect(tx.jobRepair.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: {
        repairName: "Advanced diagnostic",
        price: 35,
        category: undefined,
      },
    });
  });
  it("rejects totals exceeding the monetary column", async () => {
    const { prisma, tx } = build();
    await expect(
      editJobPart(
        prisma,
        "j1",
        "line1",
        { unitPrice: 99_999_999, quantity: 2 },
        "u1"
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });
});
