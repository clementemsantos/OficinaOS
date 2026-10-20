// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CategoryField } from "../category-field";
import { CustomerPicker } from "../customer-picker";
import { SupplierPicker } from "../supplier-picker";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  can: vi.fn(),
  change: vi.fn(),
}));
function translate(key: string) {
  return key;
}
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: translate }) }));
vi.mock("@/hooks/use-can", () => ({ useCan: () => mocks.can() }));
vi.mock("@/lib/api", () => ({
  default: mocks,
  getErrorMessage: () => "failed",
}));
function SupplierForm() {
  const [value, setValue] = useState("");
  return (
    <SupplierPicker
      onChange={(id, name) => {
        setValue(id);
        mocks.change(id, name);
      }}
      value={value}
    />
  );
}
function CustomerForm() {
  const [value, setValue] = useState("");
  return (
    <CustomerPicker
      onChange={(id, name) => {
        setValue(id);
        mocks.change(id, name);
      }}
      value={value}
    />
  );
}
describe("creating related records without leaving the form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.can.mockReturnValue(true);
    mocks.get.mockImplementation((url: string) => {
      if (url === "/customers") {
        return Promise.resolve({ data: { customers: [] } });
      }
      if (url.startsWith("/customers/")) {
        return Promise.resolve({
          data: { id: "new-customer", name: "New customer" },
        });
      }
      if (url.startsWith("/suppliers/")) {
        return Promise.resolve({
          data: { data: { id: "new-supplier", name: "New vendor" } },
        });
      }
      return Promise.resolve({ data: { data: [] } });
    });
  });
  it("creates and selects a supplier with contact details", async () => {
    mocks.post.mockResolvedValue({
      data: { data: { id: "new-supplier", name: "New vendor" } },
    });
    render(<SupplierForm />);
    fireEvent.change(
      screen.getByRole("combobox", { name: "catalog.supplier" }),
      { target: { value: "New vendor" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "catalog.create" }));
    expect(screen.getByLabelText("catalog.name")).toHaveValue("New vendor");
    fireEvent.change(screen.getByLabelText("catalog.email"), {
      target: { value: "vendor@example.invalid" },
    });
    fireEvent.change(screen.getByLabelText("catalog.phone"), {
      target: { value: "210000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith("/suppliers", {
        name: "New vendor",
        email: "vendor@example.invalid",
        phone: "210000000",
      })
    );
    expect(mocks.change).toHaveBeenLastCalledWith("new-supplier", "New vendor");
    expect(screen.getByRole("combobox")).toHaveValue("New vendor");
  });
  it("creates and selects a customer through the existing customer API", async () => {
    mocks.post.mockResolvedValue({
      data: { id: "new-customer", name: "New customer" },
    });
    render(<CustomerForm />);
    fireEvent.change(
      screen.getByRole("combobox", { name: "catalog.customer" }),
      { target: { value: "New customer" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "catalog.create" }));
    fireEvent.change(screen.getByLabelText("catalog.phone"), {
      target: { value: "910000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    await waitFor(() =>
      expect(mocks.change).toHaveBeenLastCalledWith(
        "new-customer",
        "New customer"
      )
    );
    expect(mocks.post).toHaveBeenCalledWith("/customers", {
      name: "New customer",
      phone: "910000000",
      email: undefined,
    });
  });
  it("does not offer supplier creation to a user without catalog management permission", () => {
    mocks.can.mockReturnValue(false);
    render(<SupplierForm />);
    fireEvent.focus(screen.getByRole("combobox"));
    expect(
      screen.queryByRole("button", { name: "catalog.create" })
    ).not.toBeInTheDocument();
  });
  it("creates a subcategory and selects its new ID", async () => {
    const rows = [
      { id: "parent", name: "Computers", parentId: null, isActive: true },
    ];
    mocks.get.mockResolvedValue({ data: { data: rows } });
    mocks.post.mockImplementation(() => {
      rows.push({
        id: "child",
        name: "Keyboards",
        parentId: "parent",
        isActive: true,
      } as never);
      return Promise.resolve({ data: { data: rows[1] } });
    });
    render(
      <CategoryField
        onChange={(id) => mocks.change(id)}
        scope="PART"
        value=""
      />
    );
    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith("/catalog-categories", {
        params: { scope: "PART" },
      })
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "catalog.category" }),
      { target: { value: "Keyboards" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "catalog.create" }));
    fireEvent.focus(
      screen.getByRole("combobox", { name: "catalog.parent_category" })
    );
    fireEvent.click(await screen.findByRole("option", { name: "Computers" }));
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith("/catalog-categories", {
        scope: "PART",
        name: "Keyboards",
        parentId: "parent",
        isActive: true,
      })
    );
    expect(mocks.change).toHaveBeenCalledWith("child");
  });
});
