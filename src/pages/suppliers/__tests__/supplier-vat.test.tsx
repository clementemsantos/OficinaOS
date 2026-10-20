// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupplierModal } from "..";

const mocks = vi.hoisted(() => ({ post: vi.fn(), patch: vi.fn() }));
function translate(key: string) {
  return key;
}
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: translate }) }));
vi.mock("@/lib/api", () => ({ default: mocks }));
vi.mock("@/components/modules/tasks/record-workflow", () => ({
  RecordWorkflow: () => null,
}));
describe("VAT preference in the supplier form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.post.mockResolvedValue({});
    mocks.patch.mockResolvedValue({});
  });
  it("lets the user disable VAT while creating a supplier", async () => {
    render(
      <SupplierModal onClose={vi.fn()} onSaved={vi.fn()} supplier={null} />
    );
    const checkbox = screen.getByRole("checkbox", {
      name: "supplier_vat.charges",
    });
    expect(checkbox).toBeChecked();
    fireEvent.change(
      screen.getByLabelText("suppliers.name", { exact: false }),
      { target: { value: "EU vendor" } }
    );
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith(
        "/suppliers",
        expect.objectContaining({
          name: "EU vendor",
          chargesPurchaseVat: false,
        })
      )
    );
  });
  it("loads a disabled preference and can re-enable it on the same supplier", async () => {
    render(
      <SupplierModal
        onClose={vi.fn()}
        onSaved={vi.fn()}
        supplier={{
          id: "s1",
          name: "EU vendor",
          chargesPurchaseVat: false,
          address: null,
          email: null,
          phone: null,
          taxId: null,
          notes: null,
          isActive: true,
        }}
      />
    );
    const checkbox = screen.getByRole("checkbox", {
      name: "supplier_vat.charges",
    });
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith(
        "/suppliers/s1",
        expect.objectContaining({ chargesPurchaseVat: true })
      )
    );
  });
});
