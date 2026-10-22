// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RmaDeductionControl } from "../rma-deduction-control";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), can: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: mocks }));
vi.mock("@/hooks/use-can", () => ({ useCan: () => mocks.can() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/use-format-currency", () => ({
  useFormatCurrency: () => (amount: number) => `${amount.toFixed(2)} EUR`,
}));
const rma = {
  id: "rma1",
  quantity: 1,
  status: "OPEN",
  updatedAt: "2026-10-22T10:00:00.000Z",
  job: { jobCode: "2026/1" },
};
describe("RMA source selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.can.mockReturnValue(true);
    mocks.post.mockResolvedValue({ data: { saved: true } });
    mocks.get.mockResolvedValue({
      data: {
        data: [
          {
            id: "line1",
            name: "Screen",
            amount: "20.00",
            quantity: 1,
            available: 2,
          },
        ],
      },
    });
  });
  it("shows the original price and submits the selected line rather than a catalog price", async () => {
    const onSaved = vi.fn();
    render(<RmaDeductionControl onSaved={onSaved} rma={rma} />);
    fireEvent.click(screen.getByText("rma_discount.title"));
    fireEvent.click(screen.getByRole("button", { name: "rma_discount.find" }));
    await screen.findByText("rma_discount.amount", { exact: false });
    fireEvent.click(screen.getByRole("button", { name: "rma_discount.apply" }));
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith(
        "/supplier-rmas/rma1/deduct-piece",
        {
          kind: "JOB",
          reference: "2026/1",
          lineId: "line1",
          expectedUpdatedAt: rma.updatedAt,
        }
      )
    );
    expect(onSaved).toHaveBeenCalled();
  });
  it("hides price controls and values without financial access", () => {
    mocks.can.mockReturnValue(false);
    render(
      <RmaDeductionControl
        onSaved={vi.fn()}
        rma={{ ...rma, deductedAt: rma.updatedAt, deductedAmount: "20.00" }}
      />
    );
    expect(
      screen.queryByText("20.00 EUR", { exact: false })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
