// @vitest-environment jsdom
import type {
  OrderLineView,
  PurchaseOrderView,
} from "@shared/types/purchase-order";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrderEditor } from "../order-editor";
import { OrderLinesEditor } from "../order-lines-editor";
import { OrderLinesTable } from "../order-lines-table";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  patch: vi.fn(),
  get: vi.fn(),
  error: vi.fn(),
}));
function translate(key: string) {
  return key;
}
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: translate }) }));
vi.mock("@/hooks/use-can", () => ({ useCan: () => false }));
vi.mock("@/hooks/use-format-currency", () => ({
  useFormatCurrency: () => (amount: number) => `${amount.toFixed(2)} EUR`,
}));
vi.mock("@/lib/api", () => ({
  default: mocks,
  getErrorMessage: () => "failed",
}));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: vi.fn() } }));
vi.mock("@/components/modules/catalog/category-field", () => ({
  CategoryField: () => null,
}));
vi.mock("@/components/modules/catalog/customer-picker", () => ({
  CustomerPicker: () => null,
}));
vi.mock("@/components/modules/catalog/supplier-picker", () => ({
  SupplierPicker: () => null,
}));
vi.mock("@/components/modules/catalog/part-picker", () => ({
  PartPicker: ({
    onChange,
  }: {
    onChange: (
      id: string,
      part: {
        id: string;
        name: string;
        defaultPrice: string;
        acquisitionCost: string;
      }
    ) => void;
  }) => (
    <button
      onClick={() =>
        onChange("p1", {
          id: "p1",
          name: "Keyboard",
          defaultPrice: "30",
          acquisitionCost: "10",
        })
      }
      type="button"
    >
      Pick inventory product
    </button>
  ),
}));
const line: OrderLineView = {
  id: "l1",
  name: "Mouse",
  quantity: 2,
  partId: null,
  supplierId: null,
  reference: "",
  costGross: "10",
  quoteGross: "20",
  costVatRate: "0",
  saleVatRate: "0",
  recoverInputVat: true,
};
function Form() {
  const [lines, setLines] = useState<OrderLineView[]>([line]);
  return <OrderLinesEditor lines={lines} onChange={setLines} supplierId="s1" />;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockResolvedValue({ data: { jobs: [] } });
  mocks.post.mockResolvedValue({ data: { data: { id: "new" } } });
  mocks.patch.mockResolvedValue({ data: { data: { id: "o1" } } });
});
describe("products table inside an order", () => {
  it("edits quantities, recalculates totals and allows removing a row", () => {
    render(<Form />);
    fireEvent.click(screen.getByRole("button", { name: "edit Mouse" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("catalog.quantity"), {
      target: { value: "3" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "order_lines.apply" })
    );
    expect(
      screen.getByText("60.00 EUR", { selector: "dd" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "delete Mouse" }));
    expect(screen.getByText("order_lines.empty")).toBeInTheDocument();
  });
  it("adds an inventory product with its suggested values and retains existing products", () => {
    render(<Form />);
    fireEvent.click(screen.getByRole("button", { name: "order_lines.add" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Pick inventory product" })
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("order_lines.costGross")).toHaveValue(
      10
    );
    expect(within(dialog).getByLabelText("order_lines.quoteGross")).toHaveValue(
      30
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "order_lines.apply" })
    );
    expect(screen.getByText("Keyboard")).toBeInTheDocument();
    expect(screen.getByText("Mouse")).toBeInTheDocument();
    expect(
      screen.getByText("70.00 EUR", { selector: "dd" })
    ).toBeInTheDocument();
  });
  it("supports products with a free description and rejects zero quantities", () => {
    render(<Form />);
    fireEvent.click(screen.getByRole("button", { name: "order_lines.add" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(
      within(dialog).getByLabelText("order_lines.description", {
        exact: false,
      }),
      { target: { value: "Special cable" } }
    );
    fireEvent.change(within(dialog).getByLabelText("catalog.quantity"), {
      target: { value: "0" },
    });
    // Submit event directly also exercises server-equivalent validation, beyond native HTML constraints.
    fireEvent.submit(
      within(dialog).getByRole("form", { name: "order_lines.line_title" })
    );
    expect(screen.getByRole("alert")).toHaveTextContent("order_lines.invalid");
    fireEvent.change(within(dialog).getByLabelText("catalog.quantity"), {
      target: { value: "1" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "order_lines.apply" })
    );
    expect(screen.getByText("Special cable")).toBeInTheDocument();
  });
  it("hides all financial columns when the user lacks cost access", () => {
    render(<OrderLinesTable financial={false} lines={[line]} />);
    expect(screen.getByText("Mouse")).toBeInTheDocument();
    expect(screen.queryByText("order_lines.costGross")).not.toBeInTheDocument();
    expect(screen.queryByText("20.00 EUR")).not.toBeInTheDocument();
  });
});
describe("saving multi-line order edits", () => {
  const order = {
    id: "o1",
    title: "Peripherals",
    kind: "PRODUCT",
    supplierId: null,
    customerId: null,
    jobId: null,
    partId: null,
    customCategoryId: null,
    reference: "",
    notes: "",
    purchaseUrl: "",
    updatedAt: "2026-10-20T12:00:00.000Z",
    lines: [
      { ...line, orderId: "o1", position: 0, part: null, supplier: null },
    ],
  } as unknown as PurchaseOrderView;
  it("sends all lines with the original version and strips display-only properties", async () => {
    render(<OrderEditor onClose={vi.fn()} onSaved={vi.fn()} order={order} />);
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith(
        "/purchase-orders/o1",
        expect.objectContaining({
          expectedUpdatedAt: order.updatedAt,
          lines: [
            expect.objectContaining({
              id: "l1",
              quantity: 2,
              costGross: "10",
              quoteGross: "20",
            }),
          ],
        })
      )
    );
    const payload = mocks.patch.mock.calls[0][1];
    expect(payload.lines[0]).not.toHaveProperty("orderId");
    expect(payload.lines[0]).not.toHaveProperty("position");
    expect(payload.lines[0]).not.toHaveProperty("part");
  });
  it("preserves unsaved edits and shows a reload instruction on a conflict", async () => {
    mocks.patch.mockRejectedValue({ code: "CONFLICT" });
    const saved = vi.fn();
    render(<OrderEditor onClose={vi.fn()} onSaved={saved} order={order} />);
    fireEvent.change(screen.getByLabelText("workflow.order_title"), {
      target: { value: "My changes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith("order_lines.conflict")
    );
    expect(screen.getByLabelText("workflow.order_title")).toHaveValue(
      "My changes"
    );
    expect(saved).not.toHaveBeenCalled();
  });
  it("requires at least one product on a new order", () => {
    render(<OrderEditor onClose={vi.fn()} onSaved={vi.fn()} order={null} />);
    expect(screen.getByRole("button", { name: "save" })).toBeDisabled();
  });
});
