import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { type SearchOption, SearchPicker } from "@/components/ui/search-picker";
import { useCan } from "@/hooks/use-can";
import api from "@/lib/api";
export interface SupplierOption extends SearchOption {
  chargesPurchaseVat?: boolean;
}
export function SupplierPicker({
  id,
  value,
  onChange,
  onSelect,
}: {
  id?: string;
  value: string;
  onChange: (id: string, name: string) => void;
  onSelect?: (supplier?: SupplierOption) => void;
}) {
  const { t } = useTranslation();
  const failureMessage = t("tasks.failed");
  const canCreate = useCan({ parts: ["manageCatalog"] });
  const [options, setOptions] = useState<SupplierOption[]>([]);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [chargesPurchaseVat, setChargesPurchaseVat] = useState(true);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      api
        .get("/suppliers", { params: { search: query || undefined } })
        .then(({ data }) => {
          if (active) {
            setOptions((old) => {
              const rows: SupplierOption[] = data.data;
              const selected = old.find((option) => option.id === value);
              return selected && !rows.some((row) => row.id === value)
                ? [selected, ...rows]
                : rows;
            });
          }
        })
        .catch(() => toast.error(failureMessage));
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, failureMessage, value]);
  useEffect(() => {
    if (!value) {
      return;
    }
    let active = true;
    api
      .get(`/suppliers/${value}`)
      .then(({ data }) => {
        if (active && data.data) {
          setOptions((old) =>
            old.some((row) => row.id === value)
              ? old
              : [{ ...data.data, id: value }, ...old]
          );
        }
      })
      .catch(() => toast.error(failureMessage));
    return () => {
      active = false;
    };
  }, [value, failureMessage]);
  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/suppliers", {
        chargesPurchaseVat,
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      const supplier = data.data;
      setOptions((old) => [
        supplier,
        ...old.filter((row) => row.id !== supplier.id),
      ]);
      onChange(supplier.id, supplier.name);
      onSelect?.(supplier);
      setCreating(false);
      setEmail("");
      setPhone("");
    } catch {
      toast.error(failureMessage);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <SearchPicker
        id={id}
        label={t("catalog.supplier")}
        onChange={(id, name) => {
          onChange(id, name);
          onSelect?.(options.find((row) => row.id === id));
        }}
        onCreate={
          canCreate
            ? (text) => {
                setChargesPurchaseVat(true);
                setName(text);
                setCreating(true);
              }
            : undefined
        }
        onQuery={setQuery}
        options={options}
        value={value}
      />
      {creating && (
        <div className="space-y-2 rounded-lg border border-outline-variant p-3">
          <Field label={t("catalog.name")}>
            <Input
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </Field>
          <Field label={t("catalog.email")}>
            <Input
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </Field>
          <Field label={t("catalog.phone")}>
            <Input
              onChange={(event) => setPhone(event.target.value)}
              value={phone}
            />
          </Field>
          <Field horizontal label={t("supplier_vat.charges")}>
            <Checkbox
              checked={chargesPurchaseVat}
              onChange={(event) => setChargesPurchaseVat(event.target.checked)}
            />
          </Field>
          <p className="text-on-surface-variant text-sm">
            {t("supplier_vat.hint")}
          </p>
          <Button disabled={!name.trim()} loading={busy} onClick={save}>
            {t("save")}
          </Button>
          <Button onClick={() => setCreating(false)} variant="ghost">
            {t("cancel")}
          </Button>
        </div>
      )}
    </div>
  );
}
