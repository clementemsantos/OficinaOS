import { describe, expect, it } from "vitest";
import { orderLinesTotals } from "./business-finance";
import {
  createOrderFields,
  orderLineFields,
  orderLinesFields,
  updateOrderFields,
} from "./schemas/order-lines";

const line = {
  name: "Product",
  quantity: 2,
  reference: "",
  costGross: "123",
  quoteGross: "246",
  costVatRate: "23",
  saleVatRate: "23",
  recoverInputVat: true,
};
describe("order product line calculations", () => {
  it("extends quantities and sums mixed VAT rates without averaging them", () => {
    const result = orderLinesTotals([
      line,
      {
        ...line,
        quantity: 1,
        costGross: "106",
        costVatRate: "6",
        quoteGross: "212",
        saleVatRate: "6",
      },
    ]);
    expect(result).toEqual({
      costGross: "352.00",
      quoteGross: "704.00",
      margin: {
        costNet: "300.00",
        revenueNet: "600.00",
        profitAfterVat: "300.00",
        vatBalance: "52.00",
        marginPercent: 50,
      },
    });
  });
  it("rounds VAT on extended line amounts rather than each unit", () => {
    expect(
      orderLinesTotals([
        { ...line, quantity: 3, costGross: "0.01", quoteGross: "0.01" },
      ]).margin
    ).toMatchObject({
      costNet: "0.02",
      revenueNet: "0.02",
      profitAfterVat: "0.00",
    });
  });
  it("supports losses, non-deductible VAT and zero customer quotes", () => {
    expect(
      orderLinesTotals([
        { ...line, quantity: 1, quoteGross: "0", recoverInputVat: false },
      ]).margin
    ).toMatchObject({
      costNet: "123.00",
      profitAfterVat: "-123.00",
      marginPercent: null,
    });
  });
  it("adds decimal amounts exactly", () => {
    expect(
      orderLinesTotals([
        { ...line, quantity: 3, quoteGross: "0.10" },
        { ...line, quantity: 1, quoteGross: "0.20" },
      ]).quoteGross
    ).toBe("0.50");
  });
  it.each([
    { quantity: 0 },
    { quantity: -1 },
    { quantity: 1.5 },
    { costGross: "-1" },
    { quoteGross: "1.001" },
    { costGross: "" },
    { saleVatRate: "101" },
    { purchaseUrl: "javascript:alert(1)" },
  ])("rejects invalid line input %j without a calculation exception", (patch) => {
    expect(orderLineFields.safeParse({ ...line, ...patch }).success).toBe(
      false
    );
    expect(orderLinesFields.safeParse([{ ...line, ...patch }]).success).toBe(
      false
    );
  });
  it("bounds line counts, duplicate IDs and total amounts", () => {
    expect(orderLinesFields.safeParse([]).success).toBe(false);
    expect(
      orderLinesFields.safeParse(Array.from({ length: 101 }, () => line))
        .success
    ).toBe(false);
    expect(
      orderLinesFields.safeParse([
        { ...line, id: "l1" },
        { ...line, id: "l1" },
      ]).success
    ).toBe(false);
    expect(
      orderLinesFields.safeParse([
        { ...line, costGross: "9999999999.99", quantity: 10_000 },
      ]).success
    ).toBe(false);
  });
  it("requires a version for line edits and rejects empty line orders", () => {
    expect(updateOrderFields.safeParse({ lines: [line] }).success).toBe(false);
    expect(
      updateOrderFields.safeParse({
        lines: [line],
        expectedUpdatedAt: "2026-10-20T12:00:00.000Z",
      }).success
    ).toBe(true);
    expect(
      createOrderFields.safeParse({ title: "Order", lines: [] }).success
    ).toBe(false);
  });
});

it("keeps supplier-invoice VAT at zero independently from customer VAT and retains the margin", () => {
  const totals = orderLinesTotals([
    {
      quantity: 1,
      costGross: "100",
      quoteGross: "246",
      costVatRate: "0",
      saleVatRate: "23",
      recoverInputVat: true,
    },
  ]);
  expect(totals).toMatchObject({
    costGross: "100.00",
    quoteGross: "246.00",
    margin: {
      costNet: "100.00",
      revenueNet: "200.00",
      profitAfterVat: "100.00",
      marginPercent: 50,
    },
  });
});
