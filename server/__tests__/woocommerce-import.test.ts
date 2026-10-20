import { orderLinesTotals } from "@shared/business-finance";
import { describe, expect, it, vi } from "vitest";
import { integrationJson, publicAddress } from "../lib/integration-network.js";
import {
  syncWoo,
  wooLines,
  wooOrder,
} from "../services/woocommerce.service.js";

vi.mock("../lib/integration-network.js", async (original) => ({
  ...(await original<object>()),
  integrationJson: vi.fn(),
}));
const fixture = () => ({
  id: 42,
  number: "42",
  currency: "EUR",
  status: "processing",
  total: "10.00",
  billing: {
    first_name: "Ana",
    last_name: "Silva",
    email: "ana@test.invalid",
    phone: "910000000",
  },
  line_items: [
    { name: "Cable", quantity: 3, total: "10.00", total_tax: "0", sku: "CAB" },
  ],
  shipping_lines: [],
  fee_lines: [],
});
const settings = {
  url: "https://shop.test.invalid",
  key: "ck_test",
  secret: "cs_test",
  since: "2026-10-01T00:00:00.000Z",
};
describe("WooCommerce inbound orders", () => {
  it("preserves exact gross total and total quantity when cents cannot divide evenly", () => {
    const lines = wooLines(wooOrder.parse(fixture()));
    expect(lines.map((line) => [line.quantity, line.quoteGross])).toEqual([
      [2, "3.33"],
      [1, "3.34"],
    ]);
    expect(orderLinesTotals(lines)).toMatchObject({
      quoteGross: "10.00",
      costsComplete: false,
    });
  });
  it("includes delivery and fees and rejects an unreconciled order total", () => {
    const value = {
      ...fixture(),
      total: "14.92",
      shipping_lines: [
        { method_title: "Shipping", total: "4.00", total_tax: "0.92" },
      ],
    };
    const lines = wooLines(wooOrder.parse(value));
    expect(orderLinesTotals(lines).quoteGross).toBe("14.92");
    expect(lines.at(-1)?.saleVatRate).toBe("23.00");
    expect(() =>
      wooLines(wooOrder.parse({ ...value, total: "20.00" }))
    ).toThrow();
    expect(() => wooOrder.parse({ ...fixture(), currency: "USD" })).toThrow();
  });
  it("imports once and does not overwrite locally edited orders on another sync", async () => {
    vi.mocked(integrationJson).mockResolvedValue([fixture()]);
    let receipt: { recordId: string } | null = null;
    const db = {
      integrationReceipt: {
        findUnique: vi.fn(() => Promise.resolve(receipt)),
        create: vi.fn(async () => {
          receipt = { recordId: "local1" };
          await Promise.resolve();
        }),
      },
      customer: { findMany: vi.fn(async () => [{ id: "customer1" }]) },
      purchaseOrder: {
        create: vi.fn(async (_input: unknown) => ({ id: "local1" })),
      },
      $transaction: vi.fn(),
    };
    db.$transaction.mockImplementation((run) => run(db));
    expect((await syncWoo(db as never, settings, null)).imported).toBe(1);
    expect((await syncWoo(db as never, settings, null)).imported).toBe(0);
    expect(db.purchaseOrder.create).toHaveBeenCalledTimes(1);
    expect(db.purchaseOrder.create.mock.calls[0][0]).toMatchObject({
      data: {
        customerId: "customer1",
        quoteGross: "10.00",
        lines: {
          create: expect.arrayContaining([
            expect.objectContaining({ costKnown: false }),
          ]),
        },
      },
    });
  });
  it("blocks private, mapped-private and reserved network addresses", () => {
    for (const ip of [
      "127.0.0.1",
      "192.168.0.7",
      "100.88.163.82",
      "169.254.169.254",
      "::1",
      "::ffff:192.168.0.7",
      "fc00::1",
      "0.0.0.0",
      "224.0.0.1",
    ]) {
      expect(publicAddress(ip), ip).toBe(false);
    }
    expect(publicAddress("8.8.8.8")).toBe(true);
  });
});
