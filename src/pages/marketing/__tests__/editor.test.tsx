// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarketingEditor } from "../editor";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  patch: vi.fn(),
  t: (key: string) => key,
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: mocks.t }) }));
vi.mock("@/lib/api", () => ({ default: mocks }));
vi.mock("@/components/modules/catalog/customer-picker", () => ({
  CustomerPicker: () => null,
}));
describe("campaign editor", () => {
  it("keeps input focus and saves local budget data without calling an advertising provider", async () => {
    mocks.post.mockResolvedValue({ data: { data: { id: "campaign1" } } });
    const onSaved = vi.fn();
    render(
      <MarketingEditor
        campaigns={[]}
        kind="campaigns"
        onClose={() => undefined}
        onSaved={onSaved}
        row={null}
      />
    );
    const name = screen.getByLabelText("marketing.name");
    name.focus();
    for (const value of ["N", "Na", "Natal"]) {
      fireEvent.change(name, { target: { value } });
      expect(name).toHaveFocus();
    }
    fireEvent.change(screen.getByLabelText("marketing.budget"), {
      target: { value: "200" },
    });
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(mocks.post).toHaveBeenCalledWith(
      "/marketing/campaigns",
      expect.objectContaining({
        name: "Natal",
        budget: "200",
        spend: "0",
        channel: "GOOGLE_ADS",
        status: "DRAFT",
        startDate: null,
        endDate: null,
      })
    );
  });
});
