import type { RecordLabel } from "@shared/types/purchase-order";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import api from "@/lib/api";

export function OrderFilters({
  params,
  onChange,
}: {
  params: URLSearchParams;
  onChange: (params: URLSearchParams) => void;
}) {
  const { t } = useTranslation();
  const [options, setOptions] = useState<{
    states: RecordLabel[];
    customers: RecordLabel[];
    suppliers: RecordLabel[];
  }>({ states: [], customers: [], suppliers: [] });
  useEffect(() => {
    api
      .get("/purchase-orders/filters")
      .then(({ data }) => setOptions(data))
      .catch(() => toast.error(t("tasks.failed")));
  }, [t]);
  return (
    <form
      className="grid gap-3 rounded-xl bg-surface-container-low p-4 sm:grid-cols-3"
      key={params.toString()}
      onSubmit={(event) => {
        event.preventDefault();
        const next = new URLSearchParams();
        for (const [key, value] of new FormData(event.currentTarget)) {
          if (typeof value === "string" && value.trim()) {
            next.set(key, value.trim());
          }
        }
        onChange(next);
      }}
    >
      <label htmlFor="order-q">
        {t("orders_list.search")}
        <Input defaultValue={params.get("q") ?? ""} id="order-q" name="q" />
      </label>
      <label htmlFor="order-state">
        {t("orders_list.status")}
        <Select
          defaultValue={params.get("stateId") ?? ""}
          id="order-state"
          name="stateId"
        >
          <option value="">{t("orders_list.all")}</option>
          <option value="none">{t("workflow.no_status")}</option>
          {options.states.map((state) => (
            <option key={state.id} value={state.id}>
              {state.name}
            </option>
          ))}
        </Select>
      </label>
      <label htmlFor="order-kind">
        {t("orders_list.kind")}
        <Select
          defaultValue={params.get("kind") ?? ""}
          id="order-kind"
          name="kind"
        >
          <option value="">{t("orders_list.all")}</option>
          <option value="PRODUCT">{t("orders_list.product")}</option>
          <option value="PART">{t("orders_list.part")}</option>
        </Select>
      </label>
      {(
        [
          ["customerId", "customers", "customer"],
          ["supplierId", "suppliers", "supplier"],
        ] as const
      ).map(([key, source, label]) => (
        <label htmlFor={`order-${key}`} key={key}>
          {t(`orders_list.${label}`)}
          <Select
            defaultValue={params.get(key) ?? ""}
            id={`order-${key}`}
            name={key}
          >
            <option value="">{t("orders_list.all")}</option>
            {options[source].map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </label>
      ))}
      <div className="flex gap-2">
        {["from", "to"].map((key) => (
          <label htmlFor={`order-${key}`} key={key}>
            {t(`orders_list.${key}`)}
            <Input
              defaultValue={params.get(key) ?? ""}
              id={`order-${key}`}
              name={key}
              type="date"
            />
          </label>
        ))}
      </div>
      <div className="flex gap-3">
        <Button type="submit">{t("orders_list.filter")}</Button>
        <Button
          onClick={() => onChange(new URLSearchParams())}
          type="button"
          variant="secondary"
        >
          {t("orders_list.clear")}
        </Button>
      </div>
    </form>
  );
}
