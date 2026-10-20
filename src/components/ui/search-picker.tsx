import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./button";
import { Input } from "./input";
export interface SearchOption {
  id: string;
  name: string;
}
export function SearchPicker({
  id,
  label,
  value,
  options,
  onChange,
  onQuery,
  onCreate,
  disabled = false,
  clearOnSearch = true,
}: {
  id?: string;
  label: string;
  value: string;
  options: SearchOption[];
  onChange: (id: string, name: string) => void;
  onQuery?: (query: string) => void;
  onCreate?: (name: string) => void;
  disabled?: boolean;
  clearOnSearch?: boolean;
}) {
  const { t } = useTranslation();
  const generated = useId();
  const listId = `${generated}-options`;
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const selected = options.find((option) => option.id === value);
  const filtered = onQuery
    ? options
    : options.filter((option) =>
        option.name
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLocaleLowerCase()
          .includes(
            query
              .normalize("NFD")
              .replace(/\p{Diacritic}/gu, "")
              .toLocaleLowerCase()
          )
      );
  useEffect(() => {
    const outside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, []);
  const pick = (option: SearchOption) => {
    onChange(option.id, option.name);
    setOpen(false);
    setQuery("");
  };
  return (
    <div className="relative space-y-1" ref={root}>
      <Input
        aria-activedescendant={
          open && filtered[active] ? `${listId}-${active}` : undefined
        }
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
        aria-label={label}
        disabled={disabled}
        id={id}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActive(0);
          if (clearOnSearch) {
            onChange("", "");
          }
          onQuery?.(event.target.value);
        }}
        onFocus={() => {
          setOpen(true);
          setActive(0);
          onQuery?.("");
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            setOpen(false);
            setQuery("");
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActive((old) =>
              Math.max(
                0,
                Math.min(
                  filtered.length - 1,
                  old + (event.key === "ArrowDown" ? 1 : -1)
                )
              )
            );
          }
          if (event.key === "Enter" && open) {
            event.preventDefault();
            if (filtered[active]) {
              pick(filtered[active]);
            }
          }
        }}
        placeholder={t("catalog.search")}
        role="combobox"
        value={open ? query : (selected?.name ?? "")}
      />
      {open && (
        <div className="absolute inset-x-0 top-full z-50 max-h-64 overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-lowest p-1 shadow-lg">
          <div aria-label={label} id={listId} role="listbox">
            {filtered.map((option, index) => (
              <button
                aria-selected={index === active}
                className="block w-full rounded px-3 py-2 text-left hover:bg-surface-container"
                id={`${listId}-${index}`}
                key={option.id}
                onClick={() => pick(option)}
                role="option"
                type="button"
              >
                {option.name}
              </button>
            ))}
          </div>
          {!filtered.length && (
            <p className="p-3 text-sm">{t("catalog.no_matches")}</p>
          )}
          <Button
            onClick={() => {
              onChange("", "");
              setOpen(false);
              setQuery("");
            }}
            size="sm"
            variant="ghost"
          >
            {t("catalog.clear")}
          </Button>
          {onCreate && (
            <Button
              onClick={() => {
                setOpen(false);
                onCreate(query);
              }}
              size="sm"
              variant="ghost"
            >
              {t("catalog.create")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
