// @vitest-environment jsdom

import type { PurchaseOrderView } from "@shared/types/purchase-order";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { OrdersTable } from "../orders-table";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/use-format-currency", () => ({
  useFormatCurrency: () => (value: number) => `${value.toFixed(2)} EUR`,
}));
const order = {
  id: "order1",
  number: 42,
  title: "Laptop",
  reference: "SUPPLIER-REF",
  customer: { id: "c1", name: "Ana" },
  supplier: null,
  createdAt: "2026-10-22T10:00:00Z",
  costGross: "20",
  quoteGross: "30",
  margin: { profitAfterVat: "10", marginPercent: 33.33 },
} as PurchaseOrderView;
describe("order overview", () => {
  it("opens a single record from its stable reference and keeps totals and margin visible", () => {
    render(
      <MemoryRouter>
        <OrdersTable financial orders={[order]} />
      </MemoryRouter>
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "EN-000042" })).toHaveAttribute(
      "href",
      "/purchase-orders?recordId=order1"
    );
    expect(screen.getByText("SUPPLIER-REF")).toBeInTheDocument();
    expect(screen.getByText("20.00 EUR")).toBeInTheDocument();
    expect(screen.getByText("30.00 EUR")).toBeInTheDocument();
    expect(screen.getByText("10.00 EUR · 33.33%")).toBeInTheDocument();
  });
  it("hides financial columns for staff without financial access", () => {
    render(
      <MemoryRouter>
        <OrdersTable financial={false} orders={[order]} />
      </MemoryRouter>
    );
    expect(screen.queryByText("orders_list.cost")).not.toBeInTheDocument();
    expect(screen.queryByText("30.00 EUR")).not.toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
  });
});
