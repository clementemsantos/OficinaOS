// @vitest-environment jsdom

import { listPartsQuerySchema } from "@shared/schemas/parts-catalog.schema";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SupplierRmasPage, { RmaModal } from "..";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/hooks/use-can", () => ({ useCan: () => true }));
vi.mock("@/hooks/use-technicians", () => ({
  useTechnicians: () => ({ technicians: [] }),
}));
vi.mock("@/lib/api", () => ({
  default: { get: mocks.get, patch: mocks.patch },
}));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: vi.fn() } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: translate }),
}));

function translate(key: string) {
  return key;
}

describe("RMA supplier selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    false,
    true,
  ])("keeps registered suppliers selectable when parts fail: %s", async (partsFail) => {
    mocks.get.mockImplementation((url, options) => {
      if (url === "/suppliers") {
        return Promise.resolve({
          data: { data: [{ id: "s1", name: "ACME" }] },
        });
      }
      if (url === "/parts") {
        expect(listPartsQuerySchema.safeParse(options.params).success).toBe(
          true
        );
        if (partsFail) {
          return Promise.reject(new Error("parts unavailable"));
        }
        return Promise.resolve({ data: { parts: [] } });
      }
      if (url === "/jobs") {
        return Promise.resolve({ data: { jobs: [] } });
      }
      return Promise.resolve({ data: { data: [] } });
    });
    render(
      <MemoryRouter>
        <SupplierRmasPage />
      </MemoryRouter>
    );
    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith(
        "/supplier-rmas",
        expect.anything()
      )
    );
    await waitFor(() =>
      expect(screen.queryByText("rmas.empty")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "rmas.add" }));
    fireEvent.focus(screen.getByRole("combobox", { name: "catalog.supplier" }));
    fireEvent.click(await screen.findByRole("option", { name: "ACME" }));
    expect(
      screen.getByRole("combobox", { name: "catalog.supplier" })
    ).toHaveValue("ACME");
    if (partsFail) {
      await waitFor(() =>
        expect(mocks.error).toHaveBeenCalledWith("tasks.failed")
      );
    }
  });
});

it("edits an existing RMA and clears reference and reason without creating another record", async () => {
  mocks.patch.mockResolvedValue({ data: { data: { id: "r1" } } });
  mocks.get.mockImplementation((url: string) => {
    if (url === "/jobs") {
      return Promise.resolve({ data: { jobs: [] } });
    }
    if (url === "/parts") {
      return Promise.resolve({ data: { parts: [] } });
    }
    if (url.startsWith("/suppliers/")) {
      return Promise.resolve({ data: { data: { id: "s1", name: "ACME" } } });
    }
    return Promise.resolve({ data: { data: [{ id: "s1", name: "ACME" }] } });
  });
  const saved = vi.fn();
  render(
    <RmaModal
      editing={{
        id: "r1",
        supplier: { id: "s1", name: "ACME" },
        job: { id: "j1", jobCode: "2026/1" },
        part: { id: "p1", name: "Screen" },
        description: "Broken",
        quantity: 2,
        reference: "REF",
        reason: "Fault",
        status: "OPEN",
        createdAt: "2026-10-20",
        resolvedAt: null,
        sentAt: null,
      }}
      jobCode=""
      onClose={vi.fn()}
      onSaved={saved}
    />
  );
  await waitFor(() =>
    expect(
      screen.getByRole("combobox", { name: "catalog.supplier" })
    ).toHaveValue("ACME")
  );
  expect(screen.getByRole("combobox", { name: "rmas.part" })).toHaveValue(
    "Screen"
  );
  expect(screen.getByRole("combobox", { name: "rmas.job_code" })).toHaveValue(
    "2026/1"
  );
  fireEvent.change(screen.getByLabelText(/^rmas.description/), {
    target: { value: "Updated screen" },
  });
  fireEvent.change(screen.getByLabelText("rmas.reference"), {
    target: { value: "" },
  });
  fireEvent.change(screen.getByLabelText("rmas.reason"), {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() =>
    expect(mocks.patch).toHaveBeenCalledWith("/supplier-rmas/r1", {
      supplierId: "s1",
      partId: "p1",
      jobCode: "2026/1",
      description: "Updated screen",
      quantity: 2,
      reference: "",
      reason: "",
    })
  );
  await waitFor(() => expect(saved).toHaveBeenCalled());
});
