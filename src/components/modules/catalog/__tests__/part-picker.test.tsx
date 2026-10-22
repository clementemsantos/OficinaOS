// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PartPicker } from "../part-picker";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), can: vi.fn() }));
function translate(key: string) {
  return key;
}
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: translate }) }));
vi.mock("@/hooks/use-can", () => ({ useCan: mocks.can }));
vi.mock("@/lib/api", () => ({ default: mocks }));
vi.mock("@/components/modules/parts/add-part-modal", () => ({
  default: ({ onSubmit }: { onSubmit: (value: unknown) => Promise<void> }) => (
    <button
      onClick={() =>
        onSubmit({
          name: "New keyboard",
          category: "OTHER",
          defaultPrice: 30,
          stockQuantity: 0,
        })
      }
      type="button"
    >
      Save inventory item
    </button>
  ),
}));
describe("inventory selection within another form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.can.mockReturnValue(true);
    mocks.get.mockResolvedValue({
      data: {
        parts: [
          {
            id: "p1",
            name: "Keyboard",
            defaultPrice: "30",
            acquisitionCost: "10",
            supplierId: "s1",
          },
        ],
      },
    });
  });
  it("passes the selected catalog details so the order can prefill values", async () => {
    const change = vi.fn();
    render(<PartPicker onChange={change} value="" />);
    fireEvent.focus(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: "Keyboard" }));
    expect(change).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({
        name: "Keyboard",
        defaultPrice: "30",
        acquisitionCost: "10",
      })
    );
  });
  it("selects a newly created article from the direct POST /parts response", async () => {
    const created = { id: "p-new", name: "New keyboard", defaultPrice: 30 };
    mocks.post.mockResolvedValue({ data: created });
    const change = vi.fn();
    render(<PartPicker onChange={change} value="" />);
    fireEvent.focus(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("button", { name: "catalog.create" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Save inventory item" })
    );
    await waitFor(() => expect(change).toHaveBeenCalledWith("p-new", created));
    expect(
      screen.queryByRole("button", { name: "Save inventory item" })
    ).not.toBeInTheDocument();
  });
});
