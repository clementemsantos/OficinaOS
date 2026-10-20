import { PartCategory, RepairCategory } from "@shared/constants";
import type { CategoryScope } from "@shared/schemas/catalog-category";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchPicker } from "@/components/ui/search-picker";
import { useCan } from "@/hooks/use-can";
import api from "@/lib/api";

interface Category {
  id: string;
  isActive: boolean;
  name: string;
  parentId: string | null;
}
function categoryPath(row: Category, rows: Category[]): string {
  const names = [row.name];
  const visited = new Set([row.id]);
  let parentId = row.parentId;
  while (parentId) {
    const parent = rows.find((value) => value.id === parentId);
    if (!parent || visited.has(parent.id)) {
      break;
    }
    visited.add(parent.id);
    names.unshift(parent.name);
    parentId = parent.parentId;
  }
  return names.join(" › ");
}
export function CategoryField({
  scope,
  value,
  onChange,
  disabled = false,
  base,
  filter = false,
  clearOnSearch = true,
}: {
  scope: CategoryScope;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  filter?: boolean;
  clearOnSearch?: boolean;
  base?: { value: string; onChange: (value: string) => void };
}) {
  const { t } = useTranslation();
  const failureMessage = t("tasks.failed");
  const part = useCan({ parts: ["manageCatalog"] });
  const repair = useCan({ repairs: ["manageCatalog"] });
  const admin = useCan({ settings: ["edit"] });
  const customer = useCan({ customers: ["edit"] });
  let edit = admin;
  if (scope === "PART" || scope === "SUPPLIER" || scope === "ORDER") {
    edit = part;
  }
  if (scope === "REPAIR") {
    edit = repair;
  }
  if (scope === "CUSTOMER") {
    edit = customer;
  }
  const [rows, setRows] = useState<Category[]>([]);
  const [form, setForm] = useState<{
    id?: string;
    name: string;
    parentId: string;
    isActive: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/catalog-categories", {
        params: { scope },
      });
      setRows(data.data);
    } catch {
      toast.error(failureMessage);
    }
  }, [scope, failureMessage]);
  useEffect(() => {
    load();
    const changed = (event: Event) => {
      if ((event as CustomEvent).detail === scope) {
        load();
      }
    };
    window.addEventListener("catalog-categories-changed", changed);
    return () =>
      window.removeEventListener("catalog-categories-changed", changed);
  }, [load, scope]);
  const save = async () => {
    if (!form) {
      return;
    }
    setBusy(true);
    try {
      const data = {
        scope,
        name: form.name,
        parentId: form.parentId || null,
        isActive: form.isActive,
      };
      const response = form.id
        ? await api.patch(`/catalog-categories/${form.id}`, data)
        : await api.post("/catalog-categories", data);
      await load();
      change(form.isActive ? response.data.data.id : "");
      setForm(null);
      window.dispatchEvent(
        new CustomEvent("catalog-categories-changed", { detail: scope })
      );
    } catch {
      toast.error(failureMessage);
    } finally {
      setBusy(false);
    }
  };
  const baseOptions =
    base && (scope === "PART" || scope === "REPAIR")
      ? Object.values(scope === "PART" ? PartCategory : RepairCategory).map(
          (key) => ({
            id: `base:${key}`,
            name: t(
              `${scope === "PART" ? "part_category" : "repair_category"}.${key}`
            ),
          })
        )
      : [];
  const change = (id: string) => {
    if (base && id.startsWith("base:")) {
      base.onChange(id.slice(5));
      onChange("");
      return;
    }
    if (base && filter) {
      base.onChange("ALL");
    }
    // Preserve the historical base type when assigning a custom category.
    if (base && id && !base.value) {
      base.onChange("OTHER");
    }
    onChange(id);
  };
  const pickerValue =
    value || (base?.value && base.value !== "ALL" ? `base:${base.value}` : "");
  const selected = rows.find((row) => row.id === value);
  return (
    <div className="my-3 space-y-2">
      <p className="font-medium text-sm">{t("catalog.category")}</p>
      <SearchPicker
        clearOnSearch={clearOnSearch}
        disabled={disabled}
        label={t("catalog.category")}
        onChange={change}
        onCreate={
          edit
            ? (name) => setForm({ name, parentId: "", isActive: true })
            : undefined
        }
        options={[
          ...baseOptions,
          ...rows
            .filter((row) => row.isActive || row.id === value)
            .map((row) => ({ id: row.id, name: categoryPath(row, rows) })),
        ]}
        value={pickerValue}
      />
      {edit && selected && (
        <Button
          onClick={() =>
            setForm({
              id: selected.id,
              name: selected.name,
              parentId: selected.parentId ?? "",
              isActive: selected.isActive,
            })
          }
          size="sm"
          variant="ghost"
        >
          {t("catalog.edit_category")}
        </Button>
      )}
      {form && (
        <div className="space-y-2 rounded-lg border border-outline-variant p-3">
          <Input
            aria-label={t("catalog.name")}
            maxLength={120}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            value={form.name}
          />
          <SearchPicker
            label={t("catalog.parent_category")}
            onChange={(id) => setForm({ ...form, parentId: id })}
            options={rows
              .filter((row) => row.isActive && row.id !== form.id)
              .map((row) => ({ id: row.id, name: categoryPath(row, rows) }))}
            value={form.parentId}
          />
          <label className="flex items-center gap-2">
            <input
              checked={form.isActive}
              onChange={(event) =>
                setForm({ ...form, isActive: event.target.checked })
              }
              type="checkbox"
            />
            {t("catalog.active")}
          </label>
          <Button disabled={!form.name.trim()} loading={busy} onClick={save}>
            {t("save")}
          </Button>
          <Button onClick={() => setForm(null)} variant="ghost">
            {t("cancel")}
          </Button>
        </div>
      )}
    </div>
  );
}
