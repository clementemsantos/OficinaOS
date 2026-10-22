// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TradeIn } from "@/lib/api-trade-ins";
import TradeInModal from "../trade-in-modal";

const mocks = vi.hoisted(() => ({ update: vi.fn(), create: vi.fn() }));
function translate(key: string) {
  return key;
}
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: translate }) }));
vi.mock("@/lib/api-trade-ins", () => ({
  updateTradeIn: mocks.update,
  createTradeIn: mocks.create,
}));
vi.mock("@/lib/api", () => ({ default: {}, getErrorMessage: () => "failed" }));
vi.mock("@/hooks/use-customer-search", () => ({
  useCustomerSearch: () => ({
    query: "",
    setQuery: vi.fn(),
    results: [],
    isSearching: false,
    searchError: false,
  }),
}));
vi.mock("@/hooks/use-modal-effects", () => ({ useModalEffects: vi.fn() }));
vi.mock("@/components/reports/signature-pad", () => ({
  default: ({ onChange }: { onChange: (value: string) => void }) => (
    <button onClick={() => onChange("data:image/png;base64,abc")} type="button">
      Sign
    </button>
  ),
}));
vi.mock("@/components/modules/jobs/intake-modal/functional-checklist", () => ({
  default: () => null,
}));
const tradeIn = {
  id: "t1",
  customerId: "c1",
  customer: { id: "c1", name: "Maria", phone: "910000000" },
  sellerIdType: "CC",
  sellerIdNumber: "12345678",
  deviceBrand: "Apple",
  deviceModel: "iPhone 12",
  imei: "123",
  storage: "128GB",
  condition: "GOOD",
  functionalChecklist: {},
  notes: "Old note",
  purchasePrice: "100.00",
  paymentMethod: "CASH",
  status: "OFFERED",
} as TradeIn;
describe("editing an offered trade-in", () => {
  beforeEach(() => vi.clearAllMocks());
  it("prefills the record, requires a fresh signature and patches the existing ID", async () => {
    const saved = vi.fn();
    mocks.update.mockResolvedValue({ ...tradeIn, notes: "" });
    render(
      <TradeInModal editing={tradeIn} onClose={vi.fn()} onCreated={saved} />
    );
    expect(screen.getByText("Maria")).toBeInTheDocument();
    expect(screen.getByLabelText("tradeins.model")).toHaveValue("iPhone 12");
    expect(screen.getByRole("button", { name: "save" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("tradeins.notes"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign" }));
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(
        "t1",
        expect.objectContaining({
          notes: "",
          deviceModel: "iPhone 12",
          signatureDataUrl: "data:image/png;base64,abc",
        })
      )
    );
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update.mock.calls[0][1]).not.toHaveProperty("customerId");
    expect(saved).toHaveBeenCalled();
  });
  it("closes an unchanged existing record without a discard prompt", () => {
    const close = vi.fn();
    render(
      <TradeInModal editing={tradeIn} onClose={close} onCreated={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    expect(close).toHaveBeenCalled();
  });
});
