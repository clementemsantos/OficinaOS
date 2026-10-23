// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrderFilters } from "../order-filters";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/api", () => ({
  default: {
    get: async () => ({
      data: {
        states: [{ id: "waiting", name: "Waiting supplier" }],
        customers: [{ id: "c1", name: "Ana" }],
        suppliers: [{ id: "s1", name: "Vendor" }],
      },
    }),
  },
}));
describe("order filters", () => {
  it("submits combined filters and clears them without retaining a page cursor", async () => {
    const onChange = vi.fn();
    render(
      <OrderFilters
        onChange={onChange}
        params={new URLSearchParams("q=laptop&cursor=old")}
      />
    );
    await screen.findByRole("option", { name: "Waiting supplier" });
    fireEvent.change(screen.getByLabelText("orders_list.status"), {
      target: { value: "waiting" },
    });
    fireEvent.change(screen.getByLabelText("orders_list.customer"), {
      target: { value: "c1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "orders_list.filter" }));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    const values = onChange.mock.calls[0]?.[0] as URLSearchParams;
    expect(values.get("q")).toBe("laptop");
    expect(values.get("stateId")).toBe("waiting");
    expect(values.get("customerId")).toBe("c1");
    expect(values.has("cursor")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "orders_list.clear" }));
    expect(String(onChange.mock.calls[1]?.[0])).toBe("");
  });
});
