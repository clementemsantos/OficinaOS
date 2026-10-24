// @vitest-environment jsdom
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrderEditor } from "../order-editor";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  t: (key: string) => key,
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: mocks.t }) }));
vi.mock("@/hooks/use-can", () => ({ useCan: () => true }));
vi.mock("@/hooks/use-format-currency", () => ({
  useFormatCurrency: () => (amount: number) => `${amount.toFixed(2)} EUR`,
}));
vi.mock("@/lib/api", () => ({
  default: mocks,
  getErrorMessage: () => "failed",
}));
vi.mock("@/components/modules/catalog/customer-picker", () => ({
  CustomerPicker: () => null,
}));
vi.mock("@/components/modules/catalog/supplier-picker", () => ({
  SupplierPicker: () => null,
}));
const DESCRIPTION = /order_lines.description/;
describe("inventory creation from an order", () => {
  it("keeps typing focus, creates the catalog part, adds the line and saves the order explicitly", async () => {
    mocks.get.mockResolvedValue({ data: { data: [], jobs: [], parts: [] } });
    mocks.post.mockImplementation(async (url: string, payload: object) =>
      url === "/parts"
        ? { data: { ...payload, id: "part-new" } }
        : { data: { data: { id: "order-new" } } }
    );
    const onSaved = vi.fn();
    render(
      <OrderEditor onClose={() => undefined} onSaved={onSaved} order={null} />
    );
    fireEvent.change(screen.getByLabelText("workflow.order_title"), {
      target: { value: "New keyboard" },
    });
    fireEvent.click(screen.getByRole("button", { name: "order_lines.add" }));
    const lineDialog = screen.getByRole("dialog", {
      name: "order_lines.line_title",
    });
    fireEvent.focus(
      within(lineDialog).getByRole("combobox", {
        name: "order_lines.catalog_product",
      })
    );
    fireEvent.click(
      within(lineDialog).getByRole("button", { name: "catalog.create" })
    );
    const partDialog = screen.getByRole("dialog", {
      name: "add_part_modal.title",
    });
    const name = within(partDialog).getByLabelText("add_part_modal.part_name");
    name.focus();
    for (const value of ["K", "Ke", "Keyboard"]) {
      fireEvent.change(name, { target: { value } });
      expect(name).toHaveFocus();
    }
    const price = within(partDialog).getByLabelText(
      "add_part_modal.default_price"
    );
    price.focus();
    for (const value of ["3", "30"]) {
      fireEvent.change(price, { target: { value } });
      expect(price).toHaveFocus();
    }
    fireEvent.focus(
      within(partDialog).getByRole("combobox", { name: "catalog.category" })
    );
    fireEvent.click(
      within(partDialog).getByRole("option", { name: "part_category.OTHER" })
    );
    fireEvent.click(
      within(partDialog).getByRole("button", {
        name: "add_part_modal.add_part",
      })
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "add_part_modal.title" })
      ).not.toBeInTheDocument()
    );
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
    expect(within(lineDialog).getByLabelText(DESCRIPTION)).toHaveValue(
      "Keyboard"
    );
    await waitFor(() =>
      expect(
        within(lineDialog).getByRole("button", { name: "order_lines.apply" })
      ).toBeEnabled()
    );
    fireEvent.click(
      within(lineDialog).getByRole("button", { name: "order_lines.apply" })
    );
    expect(
      screen.getByRole("button", { name: "edit Keyboard" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("order-new"));
    expect(mocks.post).toHaveBeenCalledWith(
      "/purchase-orders",
      expect.objectContaining({
        lines: [
          expect.objectContaining({
            partId: "part-new",
            costKnown: false,
            name: "Keyboard",
            quoteGross: "30",
          }),
        ],
      })
    );
  });
});
