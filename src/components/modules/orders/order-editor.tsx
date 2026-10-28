import { orderLinesFields } from "@shared/schemas/order-lines";
import type {
  OrderLineView,
  PurchaseOrderView,
} from "@shared/types/purchase-order";
import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CategoryField } from "@/components/modules/catalog/category-field";
import { CustomerPicker } from "@/components/modules/catalog/customer-picker";
import { SupplierPicker } from "@/components/modules/catalog/supplier-picker";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SearchPicker } from "@/components/ui/search-picker";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import api, { getErrorMessage } from "@/lib/api";
import { orderLineInput } from "./order-line-data";
import { OrderLinesEditor } from "./order-lines-editor";
export function OrderEditor({
  order,
  supplierId,
  customerId,
  onClose,
  onSaved,
}: {
  order: PurchaseOrderView | null;
  supplierId?: string;
  customerId?: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { t } = useTranslation();
  const failure = t("tasks.failed");
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<OrderLineView[]>(order?.lines ?? []);
  const [form, setForm] = useState({
    title: order?.title ?? "",
    supplierId: order?.supplierId ?? supplierId ?? "",
    customerId: order?.customerId ?? customerId ?? "",
    jobId: order?.jobId ?? "",
    kind: order?.kind ?? "PRODUCT",
    customCategoryId: order?.customCategoryId ?? "",
    reference: order?.reference ?? "",
    notes: order?.notes ?? "",
    purchaseUrl: order?.purchaseUrl ?? "",
  });
  const [query, setQuery] = useState("");
  const [jobs, setJobs] = useState<{ id: string; name: string }[]>(
    order?.job ? [{ id: order.job.id, name: order.job.jobCode }] : []
  );
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("/jobs", {
          params: { limit: 100, search: query || undefined },
        });
        if (active) {
          setJobs((old) => {
            const next = data.jobs.map(
              (job: { id: string; jobCode: string }) => ({
                id: job.id,
                name: job.jobCode,
              })
            );
            const selected = old.find((job) => job.id === form.jobId);
            return selected &&
              !next.some((job: { id: string }) => job.id === selected.id)
              ? [selected, ...next]
              : next;
          });
        }
      } catch {
        if (active) {
          toast.error(failure);
        }
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, form.jobId, failure]);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) {
      return;
    }
    const parsed = orderLinesFields.safeParse(lines.map(orderLineInput));
    if (!parsed.success) {
      toast.error(t("order_lines.limit"));
      return;
    }
    setBusy(true);
    try {
      const payload = {
        ...form,
        supplierId: form.supplierId || null,
        customerId: form.customerId || null,
        jobId: form.jobId || null,
        customCategoryId: form.customCategoryId || null,
        partId: form.kind === "PRODUCT" ? null : (order?.partId ?? null),
        lines: parsed.data,
      };
      const response = order
        ? await api.patch(`/purchase-orders/${order.id}`, {
            ...payload,
            expectedUpdatedAt: order.updatedAt,
          })
        : await api.post("/purchase-orders", payload);
      toast.success(t("order_lines.saved"));
      onSaved(response.data.data.id);
    } catch (error) {
      const conflict = (error as { code?: string }).code === "CONFLICT";
      toast.error(
        conflict ? t("order_lines.conflict") : getErrorMessage(error, failure)
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="space-y-4 rounded-2xl bg-surface-container-low p-5"
      onSubmit={save}
    >
      <h2 className="font-bold text-xl">
        {t(order ? "edit" : "order_lines.new_order")}
      </h2>
      <fieldset className="space-y-4" disabled={busy}>
        <Field label={t("workflow.order_title")}>
          <Input
            maxLength={200}
            onChange={(event) =>
              setForm({ ...form, title: event.target.value })
            }
            required
            value={form.title}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("business.fields.customerId")}>
            <CustomerPicker
              onChange={(id) => setForm((old) => ({ ...old, customerId: id }))}
              value={form.customerId}
            />
          </Field>
          <Field label={t("workflow.types.SUPPLIER")}>
            <SupplierPicker
              onChange={(id) => setForm((old) => ({ ...old, supplierId: id }))}
              value={form.supplierId}
            />
          </Field>
          <Field label={t("business.fields.kind")}>
            <Select
              onChange={(event) =>
                setForm({ ...form, kind: event.target.value })
              }
              value={form.kind}
            >
              {["PRODUCT", "PART", "MIXED"].map((kind) => (
                <option key={kind} value={kind}>
                  {t(`business.values.${kind}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("business.fields.jobId")}>
            <SearchPicker
              label={t("business.fields.jobId")}
              onChange={(id) => setForm((old) => ({ ...old, jobId: id }))}
              onQuery={setQuery}
              options={jobs}
              value={form.jobId}
            />
          </Field>
        </div>
        <CategoryField
          onChange={(id) =>
            setForm((old) => ({ ...old, customCategoryId: id }))
          }
          scope="ORDER"
          value={form.customCategoryId}
        />
        <OrderLinesEditor
          lines={lines}
          onChange={setLines}
          supplierId={form.supplierId}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("workflow.reference")}>
            <Input
              maxLength={100}
              onChange={(event) =>
                setForm({ ...form, reference: event.target.value })
              }
              value={form.reference}
            />
          </Field>
          <Field label={t("business.fields.purchaseUrl")}>
            <Input
              onChange={(event) =>
                setForm({ ...form, purchaseUrl: event.target.value })
              }
              type="url"
              value={form.purchaseUrl}
            />
          </Field>
        </div>
        <Field label={t("tasks.notes")}>
          <Textarea
            maxLength={8000}
            onChange={(event) =>
              setForm({ ...form, notes: event.target.value })
            }
            value={form.notes}
          />
        </Field>
        <div className="flex gap-2">
          <Button disabled={!lines.length} loading={busy} type="submit">
            {t("save")}
          </Button>
          <Button onClick={onClose} variant="ghost">
            {t("cancel")}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
