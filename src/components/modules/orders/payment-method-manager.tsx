import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCan } from "@/hooks/use-can";
import api from "@/lib/api";
export interface CustomPaymentMethod {
  id: string;
  isActive: boolean;
  name: string;
}
export function PaymentMethodManager({
  methods,
  onChanged,
}: {
  methods: CustomPaymentMethod[];
  onChanged: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const allowed = useCan({ settings: ["edit"] });
  const [busy, setBusy] = useState(false);
  const save = async (name: string, id?: string, isActive?: boolean) => {
    setBusy(true);
    try {
      if (id) {
        await api.patch(`/purchase-orders/payment-methods/${id}`, {
          name,
          isActive,
        });
      } else {
        await api.post("/purchase-orders/payment-methods", { name });
      }
      await onChanged();
      toast.success(t("order_finance.saved"));
      return true;
    } catch {
      toast.error(t("custom_payments.failed"));
      return false;
    } finally {
      setBusy(false);
    }
  };
  if (!allowed) {
    return null;
  }
  return (
    <details className="rounded-xl bg-surface-container-low p-3">
      <summary className="cursor-pointer font-semibold">
        {t("custom_payments.manage")}
      </summary>
      <p className="my-3">{t("custom_payments.hint")}</p>
      <form
        className="my-3 flex items-end gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          if (await save(String(new FormData(form).get("name") ?? ""))) {
            form.reset();
          }
        }}
      >
        <label htmlFor="new-payment-method">
          {t("custom_payments.name")}
          <Input
            disabled={busy}
            id="new-payment-method"
            maxLength={80}
            name="name"
            required
          />
        </label>
        <Button disabled={busy} type="submit">
          {t("custom_payments.add")}
        </Button>
      </form>
      {methods.map((method) => (
        <form
          className="my-3 flex flex-wrap items-end gap-3"
          key={`${method.id}-${method.name}-${method.isActive}`}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            save(
              String(data.get("name") ?? ""),
              method.id,
              data.get("isActive") === "on"
            );
          }}
        >
          <label htmlFor={`method-name-${method.id}`}>
            {t("custom_payments.name")}
            <Input
              defaultValue={method.name}
              disabled={busy}
              id={`method-name-${method.id}`}
              maxLength={80}
              name="name"
              required
            />
          </label>
          <label className="flex gap-2">
            <input
              defaultChecked={method.isActive}
              disabled={busy}
              name="isActive"
              type="checkbox"
            />
            {t("custom_payments.active")}
          </label>
          <Button disabled={busy} type="submit" variant="secondary">
            {t("custom_payments.save")}
          </Button>
        </form>
      ))}
    </details>
  );
}
