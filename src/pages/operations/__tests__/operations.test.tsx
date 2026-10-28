// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OperationsPage from "..";

const mocks = vi.hoisted(() => ({ get: vi.fn(), t: (key: string) => key }));
vi.mock("@/lib/api", () => ({ default: mocks }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mocks.t, i18n: { language: "en" } }),
}));
function mount() {
  render(
    <MemoryRouter>
      <OperationsPage />
    </MemoryRouter>
  );
}
const row = {
  id: "c1",
  name: "Customer One",
  lastActivity: "2025-01-01T00:00:00Z",
  jobs: 3,
  sales: 1,
  orders: 0,
  messagingConsent: false,
};

describe("shop operations page", () => {
  beforeEach(() => mocks.get.mockReset());
  it("shows customer records and applies filters only on submit", async () => {
    mocks.get.mockResolvedValue({ data: { data: [row], nextCursor: null } });
    mount();
    expect(
      await screen.findByRole("link", { name: "Customer One" })
    ).toHaveAttribute("href", "/customers/c1");
    const input = screen.getByLabelText("marketing.search");
    input.focus();
    fireEvent.change(input, { target: { value: "Customer" } });
    expect(input).toHaveFocus();
    expect(mocks.get).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "orders_list.filter" }));
    await waitFor(() =>
      expect(mocks.get).toHaveBeenLastCalledWith(
        "/operations/retention",
        expect.objectContaining({
          params: expect.objectContaining({ q: "Customer", days: "180" }),
        })
      )
    );
    expect(screen.getByText("operations.consent_no")).toBeInTheDocument();
  });
  it("does not let a stale customer response overwrite a new stock view", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    mocks.get.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    mocks.get.mockResolvedValue({
      data: {
        rows: [
          {
            partId: "p1",
            partName: "Screen",
            stockQuantity: 0,
            suggestedQuantity: 2,
            avgDailyUsage: 0.1,
            daysLeft: 0,
            supplier: "Supplier",
          },
        ],
        summary: { partsAtRisk: 1, totalSuggestedQuantity: 2 },
        windowDays: 30,
      },
    });
    mount();
    fireEvent.click(screen.getByRole("button", { name: "operations.stock" }));
    expect(await screen.findByText("Screen")).toBeInTheDocument();
    resolve({ data: { data: [row], nextCursor: "c1" } });
    await waitFor(() =>
      expect(screen.queryByText("Customer One")).not.toBeInTheDocument()
    );
    expect(
      screen.queryByRole("button", { name: "tasks.more" })
    ).not.toBeInTheDocument();
  });
  it("reports a failed load and offers a retry without showing stale results", async () => {
    mocks.get.mockRejectedValueOnce(new Error("offline"));
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "marketing.failed"
    );
    mocks.get.mockResolvedValue({ data: { data: [row], nextCursor: null } });
    fireEvent.click(screen.getByRole("button", { name: "operations.retry" }));
    expect(await screen.findByText("Customer One")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
