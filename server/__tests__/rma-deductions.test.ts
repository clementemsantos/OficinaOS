import { Prisma } from "@generated/client";
import { describe, expect, it, vi } from "vitest";
import { claimFinancialRecord } from "../lib/financial-record-lock.js";
import {
  applyRmaDeduction,
  undoRmaDeduction,
} from "../services/rma-deduction.service.js";

function fixture(kind: "JOB" | "SALE" = "JOB", quantity = 1) {
  const rma = {
    id: "rma1",
    quantity,
    partId: "part1",
    jobId: null as string | null,
    updatedAt: new Date("2026-10-22T10:00:00Z"),
    status: "OPEN",
    deductedAt: null as Date | null,
    deductionReversedAt: null as Date | null,
    deductedJobPartId: null as string | null,
    deductedSaleItemId: null as string | null,
    deductedAmount: null as Prisma.Decimal | null,
  };
  const parent = {
    id: "record1",
    jobCode: "2026/1",
    saleCode: "V-1",
    invoiceDocId: null as string | null,
    invoicedAt: null,
    status: "IN_REPAIR",
    total: new Prisma.Decimal(100),
  };
  const line = {
    id: "line1",
    partId: "part1",
    quantity: 2,
    rmaQuantity: 0,
    unitPrice: new Prisma.Decimal(20),
    ...(kind === "JOB"
      ? {
          jobId: "record1",
          partName: "Screen",
          totalCost: new Prisma.Decimal(40),
        }
      : {
          saleId: "record1",
          name: "Screen",
          lineTotal: new Prisma.Decimal(40),
        }),
  };
  const change = vi.fn(
    ({
      data,
    }: {
      data: {
        rmaQuantity: { increment: number };
        totalCost?: { increment: Prisma.Decimal };
        lineTotal?: { increment: Prisma.Decimal };
      };
    }) => {
      line.rmaQuantity += data.rmaQuantity.increment;
      if ("totalCost" in line && line.totalCost && data.totalCost) {
        line.totalCost = line.totalCost.add(data.totalCost.increment);
      }
      if ("lineTotal" in line && line.lineTotal && data.lineTotal) {
        line.lineTotal = line.lineTotal.add(data.lineTotal.increment);
      }
      return Promise.resolve(line);
    }
  );
  const db = {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(() => Promise.resolve([{ id: "locked" }])),
    supplierRma: {
      findUnique: vi.fn(() => Promise.resolve(rma)),
      update: vi.fn(({ data }) => {
        Object.assign(rma, data);
        return Promise.resolve(rma);
      }),
    },
    job: {
      findUnique: vi.fn(() => Promise.resolve(parent)),
      update: vi.fn(() => Promise.resolve(parent)),
    },
    sale: {
      findUnique: vi.fn(() => Promise.resolve(parent)),
      update: vi.fn(({ data }) => {
        parent.total = parent.total.add(data.total.increment);
        return Promise.resolve(parent);
      }),
    },
    jobPart: {
      findFirst: vi.fn(() => Promise.resolve(line)),
      findUnique: vi.fn(() => Promise.resolve(line)),
      update: change,
    },
    saleItem: {
      findFirst: vi.fn(() => Promise.resolve(line)),
      findUnique: vi.fn(() => Promise.resolve(line)),
      update: change,
    },
    auditLog: { create: vi.fn(() => Promise.resolve({})) },
  };
  db.$transaction.mockImplementation((run) => run(db));
  const input = {
    kind,
    reference: kind === "JOB" ? "2026/1" : "V-1",
    lineId: "line1",
    expectedUpdatedAt: rma.updatedAt.toISOString(),
  };
  return { db, rma, parent, line, change, input };
}
describe("RMA piece value deductions", () => {
  it.each([
    "JOB",
    "SALE",
  ] as const)("deducts one unit exactly once from %s, without changing actual payments or stock", async (kind) => {
    const { db, input, line, parent, change, rma } = fixture(kind);
    await applyRmaDeduction(db as never, "rma1", input, "owner1");
    await applyRmaDeduction(db as never, "rma1", input, "owner1");
    expect(change).toHaveBeenCalledTimes(1);
    expect(line.rmaQuantity).toBe(1);
    expect(String("totalCost" in line ? line.totalCost : line.lineTotal)).toBe(
      "20"
    );
    expect(String(rma.deductedAmount)).toBe("20");
    if (kind === "SALE") {
      expect(String(parent.total)).toBe("80");
    }
    expect(db.auditLog.create).toHaveBeenCalledTimes(1);
  });
  it.each([
    "JOB",
    "SALE",
  ] as const)("restores the original value once for %s and rejects an old apply replay", async (kind) => {
    const { db, input, rma, line, parent, change } = fixture(kind);
    await applyRmaDeduction(db as never, "rma1", input, "owner1");
    const appliedVersion = rma.updatedAt.toISOString();
    await undoRmaDeduction(db as never, "rma1", appliedVersion, "owner1");
    await undoRmaDeduction(db as never, "rma1", appliedVersion, "owner1");
    expect(change).toHaveBeenCalledTimes(2);
    expect(line.rmaQuantity).toBe(0);
    expect(String("totalCost" in line ? line.totalCost : line.lineTotal)).toBe(
      "40"
    );
    expect(String(parent.total)).toBe("100");
    await expect(
      applyRmaDeduction(db as never, "rma1", input, "owner1")
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("refuses an invoice already issued, insufficient remaining units, and a mismatched part", async () => {
    for (const reason of ["invoice", "units", "part"] as const) {
      const { db, parent, line, input, change } = fixture();
      if (reason === "invoice") {
        parent.invoiceDocId = "issued";
      }
      if (reason === "units") {
        line.rmaQuantity = 2;
      }
      if (reason === "part") {
        line.partId = "other-part";
      }
      await expect(
        applyRmaDeduction(db as never, "rma1", input, "owner1")
      ).rejects.toMatchObject({
        code: reason === "invoice" ? "ALREADY_INVOICED" : "VALIDATION_ERROR",
      });
      expect(change).not.toHaveBeenCalled();
    }
  });
  it("shares the invoice issuance lock so a price cannot change during provider issuance", async () => {
    const { db, input, change } = fixture();
    const release = claimFinancialRecord("JOB", "record1", true);
    try {
      await expect(
        applyRmaDeduction(db as never, "rma1", input, "owner1")
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(change).not.toHaveBeenCalled();
    } finally {
      release();
    }
  });
});
