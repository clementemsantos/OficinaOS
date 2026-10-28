import {
  type OrderLineInput,
  orderLineFields,
} from "@shared/schemas/order-lines";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PartPicker } from "@/components/modules/catalog/part-picker";
import { SupplierPicker } from "@/components/modules/catalog/supplier-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useSupplierVat } from "./use-supplier-vat";
export function OrderLineDialog({
  initial,
  applySupplierDefaults = !initial.id,
  part,
  onClose,
  onApply,
}: {
  initial: OrderLineInput;
  applySupplierDefaults?: boolean;
  part?: { id: string; name: string } | null;
  onClose: () => void;
  onApply: (line: OrderLineInput) => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initial);
  const [quantity, setQuantity] = useState(String(initial.quantity));
  const [error, setError] = useState(false);
  const [creatingPart, setCreatingPart] = useState(false);
  const set = (patch: Partial<OrderLineInput>) =>
    setForm((old) => ({ ...old, ...patch }));
  const { withoutVat, changeWithoutVat, rateChanged } = useSupplierVat({
    supplierId: form.supplierId,
    existingLine: !applySupplierDefaults,
    initialRate: initial.costVatRate,
    onRate: (costVatRate) => setForm((old) => ({ ...old, costVatRate })),
  });
  const apply = () => {
    const result = orderLineFields.safeParse({
      ...form,
      quantity: Number(quantity),
    });
    if (!result.success) {
      setError(true);
      return;
    }
    onApply(result.data);
  };
  return (
    <Dialog
      dismissible={!creatingPart}
      onClose={onClose}
      open
      title={t("order_lines.line_title")}
    >
      <Field label={t("order_lines.catalog_product")}>
        <PartPicker
          initialPart={part}
          label={t("order_lines.catalog_product")}
          onChange={(id, selected) => {
            if (!selected) {
              set({ partId: id || null });
              return;
            }
            set({
              partId: id,
              name: selected.name,
              quoteGross: String(selected.defaultPrice ?? form.quoteGross),
              costGross: String(selected.acquisitionCost ?? form.costGross),
              costKnown: selected.acquisitionCost != null,
              supplierId: selected.supplierId ?? form.supplierId,
            });
          }}
          onCreatingChange={setCreatingPart}
          terminology="item"
          value={form.partId ?? ""}
        />
      </Field>
      <form
        aria-label={t("order_lines.line_title")}
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!creatingPart) {
            apply();
          }
        }}
      >
        <Field label={t("order_lines.description")} required>
          <Input
            maxLength={200}
            onChange={(event) => set({ name: event.target.value })}
            value={form.name}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("catalog.quantity")}>
            <Input
              max="10000"
              min="1"
              onChange={(event) => setQuantity(event.target.value)}
              step="1"
              type="number"
              value={quantity}
            />
          </Field>
          <Field label={t("workflow.reference")}>
            <Input
              maxLength={200}
              onChange={(event) => set({ reference: event.target.value })}
              value={form.reference}
            />
          </Field>
          {(
            ["costGross", "quoteGross", "costVatRate", "saleVatRate"] as const
          ).map((name) => (
            <Field key={name} label={t(`order_lines.${name}`)}>
              <Input
                disabled={name === "costVatRate" && withoutVat}
                max={name.endsWith("Rate") ? "100" : "9999999999.99"}
                min="0"
                onChange={(event) => {
                  if (name === "costVatRate") {
                    rateChanged();
                  }
                  set({
                    [name]: event.target.value,
                    ...(name === "costGross" ? { costKnown: true } : {}),
                  });
                }}
                step="0.01"
                type="number"
                value={form[name]}
              />
            </Field>
          ))}
        </div>
        <Field horizontal label={t("integrations.cost_known")}>
          <Checkbox
            checked={form.costKnown !== false}
            onChange={(event) => set({ costKnown: event.target.checked })}
          />
        </Field>
        <SupplierPicker
          onChange={(id) => set({ supplierId: id || null })}
          onSelect={(supplier) => {
            if (supplier) {
              changeWithoutVat(supplier.chargesPurchaseVat === false);
            }
          }}
          value={form.supplierId ?? ""}
        />
        <Field horizontal label={t("supplier_vat.without")}>
          <Checkbox
            checked={withoutVat}
            onChange={(event) => changeWithoutVat(event.target.checked)}
          />
        </Field>
        {withoutVat && (
          <p className="text-on-surface-variant text-sm">
            {t("supplier_vat.line_hint")}
          </p>
        )}
        <Field label={t("business.fields.purchaseUrl")}>
          <Input
            onChange={(event) => set({ purchaseUrl: event.target.value })}
            type="url"
            value={form.purchaseUrl ?? ""}
          />
        </Field>
        <Field horizontal label={t("business.fields.recoverInputVat")}>
          <Checkbox
            checked={form.recoverInputVat}
            onChange={(event) => set({ recoverInputVat: event.target.checked })}
          />
        </Field>
        {error && (
          <p className="text-error" role="alert">
            {t("order_lines.invalid")}
          </p>
        )}
        <Button disabled={creatingPart} type="submit">
          {t("order_lines.apply")}
        </Button>
        <Button onClick={onClose} variant="ghost">
          {t("cancel")}
        </Button>
      </form>
    </Dialog>
  );
}
