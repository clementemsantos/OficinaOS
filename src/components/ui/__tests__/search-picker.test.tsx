// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchPicker } from "../search-picker";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
const options = [
  { id: "s1", name: "João Componentes" },
  { id: "s2", name: "Maria Informática" },
];
describe("searchable record selection", () => {
  it("filters existing records while typing, ignoring accents", () => {
    const onChange = vi.fn();
    render(
      <SearchPicker
        label="Supplier"
        onChange={onChange}
        options={options}
        value=""
      />
    );
    const input = screen.getByRole("combobox", { name: "Supplier" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "joao" } });
    expect(
      screen.getByRole("option", { name: "João Componentes" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Maria Informática" })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "João Componentes" }));
    expect(onChange).toHaveBeenLastCalledWith("s1", "João Componentes");
  });
  it("supports choosing an existing record with the keyboard", () => {
    const onChange = vi.fn();
    render(
      <SearchPicker
        label="Supplier"
        onChange={onChange}
        options={options}
        value=""
      />
    );
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("s2", "Maria Informática");
  });
  it("passes the typed name to inline creation when no match exists", () => {
    const onCreate = vi.fn();
    render(
      <SearchPicker
        label="Supplier"
        onChange={vi.fn()}
        onCreate={onCreate}
        options={options}
        value=""
      />
    );
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "New supplier" },
    });
    fireEvent.click(screen.getByRole("button", { name: "catalog.create" }));
    expect(onCreate).toHaveBeenCalledWith("New supplier");
  });
  it("clears the old selection when the user starts a new search", () => {
    const onChange = vi.fn();
    render(
      <SearchPicker
        label="Supplier"
        onChange={onChange}
        options={options}
        value="s1"
      />
    );
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Other" },
    });
    expect(onChange).toHaveBeenCalledWith("", "");
  });
});
