// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrderFinance } from "../order-finance";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  canView: true,
  t: (key: string) => key,
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: mocks.t }) }));
vi.mock("@/lib/api", () => ({ default: { get: mocks.get, post: mocks.post } }));
vi.mock("@/hooks/use-can", () => ({ useCan: () => mocks.canView }));
vi.mock("@/hooks/use-format-currency", () => ({
  useFormatCurrency: () => (value: number) => `${value.toFixed(2)} EUR`,
}));
const finance = {
  quoteStatus: "ACCEPTED",
  quoteDecidedAt: null,
  updatedAt: "2026-10-23T10:00:00.000Z",
  total: "100",
  paid: "25",
  balance: "75",
  payments: [],
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.canView = true;
  mocks.get.mockResolvedValue({ data: { data: finance } });
  mocks.post.mockResolvedValue({ data: { saved: true } });
});
describe("order finance panel", () => {
  it("shows quoted, received and remaining amounts and records a partial payment with method and retry key", async () => {
    const onChanged = vi.fn();
    render(<OrderFinance id="o1" onChanged={onChanged} />);
    await screen.findByText("75.00 EUR");
    expect(screen.getByText("100.00 EUR")).toBeInTheDocument();
    expect(screen.getByText("25.00 EUR")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("order_finance.amount"), {
      target: { value: "20" },
    });
    fireEvent.change(screen.getByLabelText("order_finance.method"), {
      target: { value: "TRANSFER" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "order_finance.record" })
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(mocks.post).toHaveBeenCalledWith(
      "/purchase-orders/o1/payments",
      expect.objectContaining({
        amount: 20,
        method: "TRANSFER",
        expectedUpdatedAt: finance.updatedAt,
        requestKey: expect.any(String),
      })
    );
  });
  it("does not request or show financial records without permission", () => {
    mocks.canView = false;
    render(<OrderFinance id="o1" onChanged={() => undefined} />);
    expect(mocks.get).not.toHaveBeenCalled();
    expect(screen.queryByText("order_finance.title")).not.toBeInTheDocument();
  });
});
