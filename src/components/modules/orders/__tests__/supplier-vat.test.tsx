// @vitest-environment jsdom

import type { OrderLineInput } from "@shared/schemas/order-lines";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrderLineDialog } from "../order-line-dialog";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
function translate(key: string) {
  return key;
}
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: translate }) }));
vi.mock("@/lib/api", () => ({ default: mocks }));
vi.mock("@/components/modules/catalog/part-picker", () => ({
  PartPicker: () => null,
}));
vi.mock("@/components/modules/catalog/supplier-picker", () => ({
  SupplierPicker: ({
    onChange,
    onSelect,
  }: {
    onChange: (id: string) => void;
    onSelect: (value: {
      id: string;
      name: string;
      chargesPurchaseVat: boolean;
    }) => void;
  }) => (
    <button
      onClick={() => {
        onChange("s2");
        onSelect({ id: "s2", name: "EU supplier", chargesPurchaseVat: false });
      }}
      type="button"
    >
      Choose supplier without VAT
    </button>
  ),
}));
const base: OrderLineInput = {
  name: "Keyboard",
  quantity: 1,
  reference: "",
  supplierId: "s1",
  partId: null,
  costGross: "100",
  quoteGross: "246",
  costVatRate: "23",
  saleVatRate: "23",
  recoverInputVat: true,
};
describe("supplier VAT preferences in an order line", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue({
      data: { data: { chargesPurchaseVat: false } },
    });
  });
  it("defaults new purchases to zero supplier VAT without changing sales VAT or the cost", async () => {
    const apply = vi.fn();
    render(
      <OrderLineDialog
        applySupplierDefaults
        initial={base}
        onApply={apply}
        onClose={vi.fn()}
      />
    );
    await waitFor(() =>
      expect(screen.getByLabelText("order_lines.costVatRate")).toHaveValue(0)
    );
    expect(screen.getByLabelText("order_lines.costVatRate")).toBeDisabled();
    expect(screen.getByLabelText("order_lines.saleVatRate")).toHaveValue(23);
    expect(screen.getByLabelText("order_lines.costGross")).toHaveValue(100);
    fireEvent.click(screen.getByRole("button", { name: "order_lines.apply" }));
    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({
        costVatRate: "0",
        saleVatRate: "23",
        costGross: "100",
      })
    );
  });
  it("preserves stored VAT when reopening an existing line, including Strict Mode", async () => {
    render(
      <StrictMode>
        <OrderLineDialog
          applySupplierDefaults={false}
          initial={{ ...base, id: "l1" }}
          onApply={vi.fn()}
          onClose={vi.fn()}
        />
      </StrictMode>
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByLabelText("order_lines.costVatRate")).toHaveValue(23);
    expect(screen.getByLabelText("order_lines.costVatRate")).not.toBeDisabled();
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("lets the user override a supplier default for a particular invoice", async () => {
    render(
      <OrderLineDialog
        applySupplierDefaults
        initial={base}
        onApply={vi.fn()}
        onClose={vi.fn()}
      />
    );
    const checkbox = screen.getByRole("checkbox", {
      name: "supplier_vat.without",
    });
    await waitFor(() => expect(checkbox).toBeChecked());
    fireEvent.click(checkbox);
    fireEvent.change(screen.getByLabelText("order_lines.costVatRate"), {
      target: { value: "6" },
    });
    expect(screen.getByLabelText("order_lines.costVatRate")).toHaveValue(6);
    expect(screen.getByLabelText("order_lines.saleVatRate")).toHaveValue(23);
  });
  it("applies a changed supplier preference to the selected line", async () => {
    render(
      <OrderLineDialog
        applySupplierDefaults={false}
        initial={{ ...base, id: "l1" }}
        onApply={vi.fn()}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Choose supplier without VAT" })
    );
    await waitFor(() =>
      expect(screen.getByLabelText("order_lines.costVatRate")).toHaveValue(0)
    );
    expect(screen.getByLabelText("order_lines.saleVatRate")).toHaveValue(23);
  });
  it("does not overwrite a manual VAT edit when the supplier request finishes late", async () => {
    let complete: (value: unknown) => void = () => undefined;
    mocks.get.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        })
    );
    render(
      <OrderLineDialog
        applySupplierDefaults
        initial={base}
        onApply={vi.fn()}
        onClose={vi.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText("order_lines.costVatRate"), {
      target: { value: "6" },
    });
    await act(async () => {
      complete({ data: { data: { chargesPurchaseVat: false } } });
      await Promise.resolve();
    });
    expect(screen.getByLabelText("order_lines.costVatRate")).toHaveValue(6);
  });
});
