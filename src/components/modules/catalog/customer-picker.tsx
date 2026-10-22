import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { type SearchOption, SearchPicker } from "@/components/ui/search-picker";
import { useCan } from "@/hooks/use-can";
import api, { getErrorMessage } from "@/lib/api";
export function CustomerPicker({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string;
  onChange: (id: string, name: string) => void;
}) {
  const { t } = useTranslation();
  const failureMessage = t("tasks.failed");
  const create = useCan({ customers: ["create"] });
  const [rows, setRows] = useState<SearchOption[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<{
    name: string;
    phone: string;
    email: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("/customers", {
          params: { search: query || undefined, limit: 100 },
        });
        if (active) {
          setRows((old) => {
            const selected = old.find((row) => row.id === value);
            const next: SearchOption[] = data.customers;
            return selected && !next.some((row) => row.id === value)
              ? [selected, ...next]
              : next;
          });
        }
      } catch {
        if (active) {
          toast.error(failureMessage);
        }
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, value, failureMessage]);
  useEffect(() => {
    if (!value) {
      return;
    }
    let active = true;
    api
      .get(`/customers/${value}`)
      .then(({ data }) => {
        if (active) {
          setRows((old) =>
            old.some((row) => row.id === value)
              ? old
              : [{ id: data.id, name: data.name }, ...old]
          );
        }
      })
      .catch(() => toast.error(failureMessage));
    return () => {
      active = false;
    };
  }, [value, failureMessage]);
  const save = async () => {
    if (!form) {
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post("/customers", {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
      });
      setRows((old) => [data, ...old.filter((row) => row.id !== data.id)]);
      onChange(data.id, data.name);
      setForm(null);
    } catch (error) {
      toast.error(getErrorMessage(error, t("tasks.failed")));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <SearchPicker
        id={id}
        label={t("catalog.customer")}
        onChange={onChange}
        onCreate={
          create ? (name) => setForm({ name, phone: "", email: "" }) : undefined
        }
        onQuery={setQuery}
        options={rows}
        value={value}
      />
      {form && (
        <div className="space-y-2 rounded-lg border border-outline-variant p-3">
          <Field label={t("catalog.name")}>
            <Input
              maxLength={120}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              value={form.name}
            />
          </Field>
          <Field label={t("catalog.phone")}>
            <Input
              maxLength={32}
              onChange={(event) =>
                setForm({ ...form, phone: event.target.value })
              }
              value={form.phone}
            />
          </Field>
          <Field label={t("catalog.email")}>
            <Input
              maxLength={254}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
              type="email"
              value={form.email}
            />
          </Field>
          <Button
            disabled={!(form.name.trim() && form.phone.trim())}
            loading={busy}
            onClick={save}
          >
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
