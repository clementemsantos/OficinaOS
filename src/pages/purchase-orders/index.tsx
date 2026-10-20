import { orderMargin } from "@shared/business-finance";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { CategoryField } from "@/components/modules/catalog/category-field";
import { CustomerPicker } from "@/components/modules/catalog/customer-picker";
import { SupplierPicker } from "@/components/modules/catalog/supplier-picker";
import AddPartModal from "@/components/modules/parts/add-part-modal";
import { RecordWorkflow } from "@/components/modules/tasks/record-workflow";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SearchPicker } from "@/components/ui/search-picker";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCan } from "@/hooks/use-can";
import { useDebounce } from "@/hooks/use-debounce";
import api from "@/lib/api";
import { BusinessHistory } from "@/pages/business/history";

const HTTP_URL = /^https?:/;
const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
interface Order {
  costGross?: string;
  costVatRate?: string;

  createdAt: string;
  customCategoryId: string | null;
  customer: { id: string; name: string } | null;
  customerId: string | null;
  id: string;
  job?: { id: string; jobCode: string } | null;
  jobId: string | null;
  kind: string;
  margin?: {
    profitAfterVat: string;
    revenueNet: string;
    costNet: string;
    vatBalance: string;
    marginPercent: number | null;
  };
  notes: string | null;
  part?: { id: string; name: string } | null;
  partId: string | null;
  purchaseUrl: string | null;
  quoteGross?: string;
  recoverInputVat?: boolean;
  reference: string | null;
  saleVatRate?: string;
  supplier: { id: string; name: string } | null;
  supplierId: string | null;
  title: string;
}
const EMPTY = {
  customCategoryId: "",
  title: "",
  supplierId: "",
  reference: "",
  notes: "",
  kind: "PRODUCT",
  purchaseUrl: "",
  customerId: "",
  jobId: "",
  partId: "",
  costGross: "0",
  quoteGross: "0",
  costVatRate: "0",
  saleVatRate: "0",
  recoverInputVat: true,
};
export default function PurchaseOrdersPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const recordId = params.get("recordId") || undefined;
  const supplierId = params.get("supplierId") || undefined;
  const customerId = params.get("customerId") || undefined;
  const [partQuery, setPartQuery] = useState("");
  const [jobQuery, setJobQuery] = useState("");
  const [creatingPart, setCreatingPart] = useState(false);
  const partSearch = useDebounce(partQuery, 250);
  const jobSearch = useDebounce(jobQuery, 250);
  const [jobs, setJobs] = useState<{ id: string; name: string }[]>([]);
  const [parts, setParts] = useState<{ id: string; name: string }[]>([]);
  const financial = useCan({ parts: ["viewCost"] });
  const [orders, setOrders] = useState<Order[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [form, setForm] = useState({
    ...EMPTY,
    supplierId: supplierId ?? "",
    customerId: customerId ?? "",
  });
  const [editing, setEditing] = useState("");
  const [busy, setBusy] = useState(false);
  const edit = useCan({ parts: ["manageCatalog", "viewCost"] });
  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/purchase-orders", {
        params: { supplierId, customerId, recordId },
      });
      setOrders(data.data);
      setCursor(data.nextCursor);
    } catch {
      toast.error(t("tasks.failed"));
    }
  }, [supplierId, customerId, recordId, t]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!edit) {
      return;
    }
    let active = true;
    api
      .get("/parts", {
        params: { limit: 100, search: partSearch || undefined },
      })
      .then(({ data }) => {
        if (active) {
          setParts((old) => retainSelected(data.parts, old, form.partId));
        }
      })
      .catch(() => toast.error(t("tasks.failed")));
    return () => {
      active = false;
    };
  }, [edit, partSearch, form.partId, t]);
  useEffect(() => {
    if (!edit) {
      return;
    }
    let active = true;
    api
      .get("/jobs", { params: { limit: 100, search: jobSearch || undefined } })
      .then(({ data }) => {
        if (active) {
          setJobs((old) =>
            retainSelected(
              data.jobs.map((row: { id: string; jobCode: string }) => ({
                id: row.id,
                name: row.jobCode,
              })),
              old,
              form.jobId
            )
          );
        }
      })
      .catch(() => toast.error(t("tasks.failed")));
    return () => {
      active = false;
    };
  }, [edit, jobSearch, form.jobId, t]);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const data = {
        ...form,
        customCategoryId: form.customCategoryId || null,
        supplierId: form.supplierId || null,
        customerId: form.customerId || null,
        jobId: form.jobId || null,
        partId: form.kind === "PART" ? form.partId || null : null,
      };
      if (editing) {
        await api.patch(`/purchase-orders/${editing}`, data);
      } else {
        await api.post("/purchase-orders", data);
      }
      setEditing("");
      setForm({
        ...EMPTY,
        supplierId: supplierId ?? "",
        customerId: customerId ?? "",
      });
      await load();
    } catch {
      toast.error(t("tasks.failed"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-5">
      {creatingPart && (
        <AddPartModal
          onClose={() => setCreatingPart(false)}
          onSubmit={async (data) => {
            const response = await api.post("/parts", data);
            setParts((old) => [
              response.data,
              ...old.filter((row) => row.id !== response.data.id),
            ]);
            setForm((old) => ({ ...old, partId: response.data.id }));
            setCreatingPart(false);
          }}
        />
      )}
      <h1 className="font-bold text-2xl">{t("workflow.orders")}</h1>
      {edit && (
        <form
          className="space-y-3 rounded-2xl bg-surface-container-low p-5"
          onSubmit={save}
        >
          <Field label={t("workflow.order_title")}>
            <Input
              maxLength={200}
              onChange={(e) =>
                setForm((old) => ({ ...old, title: e.target.value }))
              }
              required
              value={form.title}
            />
          </Field>
          <Field label={t("workflow.types.SUPPLIER")}>
            <SupplierPicker
              onChange={(id) => setForm((old) => ({ ...old, supplierId: id }))}
              value={form.supplierId}
            />
          </Field>
          {form.kind === "PART" && (
            <Button onClick={() => setCreatingPart(true)} variant="secondary">
              {t("catalog.new_inventory_part")}
            </Button>
          )}
          <CategoryField
            onChange={(id) =>
              setForm((old) => ({ ...old, customCategoryId: id }))
            }
            scope="ORDER"
            value={form.customCategoryId}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("business.fields.kind")}>
              <Select
                onChange={(e) =>
                  setForm((old) => ({
                    ...old,
                    kind: e.target.value,
                    partId: "",
                  }))
                }
                value={form.kind}
              >
                {["PRODUCT", "PART"].map((kind) => (
                  <option key={kind} value={kind}>
                    {t(`business.values.${kind}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("business.fields.customerId")}>
              <CustomerPicker
                onChange={(id) =>
                  setForm((old) => ({ ...old, customerId: id }))
                }
                value={form.customerId}
              />
            </Field>
            <Field label={t("business.fields.jobId")}>
              <SearchPicker
                label={t("business.fields.jobId")}
                onChange={(id) => setForm((old) => ({ ...old, jobId: id }))}
                onQuery={setJobQuery}
                options={jobs}
                value={form.jobId}
              />
            </Field>
            {form.kind === "PART" && (
              <Field label={t("business.fields.partId")}>
                <SearchPicker
                  label={t("business.fields.partId")}
                  onChange={(id) => setForm((old) => ({ ...old, partId: id }))}
                  onQuery={setPartQuery}
                  options={parts}
                  value={form.partId}
                />
              </Field>
            )}
            <Field label={t("business.fields.purchaseUrl")}>
              <Input
                onChange={(e) =>
                  setForm((old) => ({ ...old, purchaseUrl: e.target.value }))
                }
                type="url"
                value={form.purchaseUrl}
              />
            </Field>
            {(
              ["costGross", "quoteGross", "costVatRate", "saleVatRate"] as const
            ).map((name) => (
              <Field key={name} label={t(`business.fields.${name}`)}>
                <Input
                  max={name.endsWith("Rate") ? "100" : "9999999999.99"}
                  min="0"
                  onChange={(e) =>
                    setForm((old) => ({ ...old, [name]: e.target.value }))
                  }
                  step="0.01"
                  type="number"
                  value={form[name]}
                />
              </Field>
            ))}
            <Field horizontal label={t("business.fields.recoverInputVat")}>
              <Checkbox
                checked={form.recoverInputVat}
                onChange={(e) =>
                  setForm((old) => ({
                    ...old,
                    recoverInputVat: e.target.checked,
                  }))
                }
              />
            </Field>
          </div>
          {[
            form.costGross,
            form.quoteGross,
            form.costVatRate,
            form.saleVatRate,
          ].every((value) => MONEY_PATTERN.test(value)) && (
            <p>
              {t("business.margin")}: {orderMargin(form).profitAfterVat} € ·{" "}
              {orderMargin(form).marginPercent ?? "—"}%
            </p>
          )}
          <p className="text-sm">{t("business.margin_hint")}</p>
          <Field label={t("workflow.reference")}>
            <Input
              maxLength={100}
              onChange={(e) =>
                setForm((old) => ({ ...old, reference: e.target.value }))
              }
              value={form.reference}
            />
          </Field>
          <Field label={t("tasks.notes")}>
            <Textarea
              maxLength={8000}
              onChange={(e) =>
                setForm((old) => ({ ...old, notes: e.target.value }))
              }
              value={form.notes}
            />
          </Field>
          <Button loading={busy} type="submit">
            {t("save")}
          </Button>
          {editing && (
            <Button
              onClick={() => {
                setEditing("");
                setForm(EMPTY);
              }}
            >
              {t("cancel")}
            </Button>
          )}
        </form>
      )}
      {orders.length === 0 && <p>{t("workflow.no_orders")}</p>}
      {orders.map((order) => (
        <article
          className="rounded-2xl bg-surface-container-low p-5"
          key={order.id}
        >
          <div className="flex justify-between gap-3">
            <h2 className="font-bold">{order.title}</h2>
            {edit && (
              <Button
                onClick={() => {
                  setEditing(order.id);
                  setForm({
                    customCategoryId: order.customCategoryId ?? "",
                    kind: order.kind,
                    purchaseUrl: order.purchaseUrl ?? "",
                    customerId: order.customerId ?? "",
                    jobId: order.jobId ?? "",
                    partId: order.partId ?? "",
                    costGross: order.costGross ?? "0",
                    quoteGross: order.quoteGross ?? "0",
                    costVatRate: order.costVatRate ?? "0",
                    saleVatRate: order.saleVatRate ?? "0",
                    recoverInputVat: order.recoverInputVat ?? true,
                    title: order.title,
                    supplierId: order.supplierId ?? "",
                    reference: order.reference ?? "",
                    notes: order.notes ?? "",
                  });
                  if (order.part) {
                    setParts((old) =>
                      retainSelected(
                        [order.part as { id: string; name: string }],
                        old,
                        order.partId ?? ""
                      )
                    );
                  }
                  const selectedJob = order.job;
                  if (selectedJob) {
                    setJobs((old) =>
                      retainSelected(
                        [{ id: selectedJob.id, name: selectedJob.jobCode }],
                        old,
                        order.jobId ?? ""
                      )
                    );
                  }
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                {t("edit")}
              </Button>
            )}
          </div>
          <p>
            {order.supplier?.name} · {order.reference} ·{" "}
            {new Date(order.createdAt).toLocaleDateString()}
          </p>
          <p className="whitespace-pre-wrap">{order.notes}</p>
          <p>
            {t(`business.values.${order.kind}`)} · {order.customer?.name}
          </p>
          {order.jobId && (
            <Link
              className="text-primary underline"
              to={`/jobs/${order.jobId}`}
            >
              {t("business.fields.jobId")}
            </Link>
          )}
          {order.purchaseUrl && HTTP_URL.test(order.purchaseUrl) && (
            <a
              className="ml-3 text-primary underline"
              href={order.purchaseUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              {t("business.fields.purchaseUrl")}
            </a>
          )}
          {financial && order.margin && (
            <dl className="my-3 grid gap-2 sm:grid-cols-2">
              <div>
                <dt>{t("business.fields.costGross")}</dt>
                <dd>{order.costGross} €</dd>
              </div>
              <div>
                <dt>{t("business.fields.quoteGross")}</dt>
                <dd>{order.quoteGross} €</dd>
              </div>
              <div>
                <dt>{t("business.margin")}</dt>
                <dd>
                  {order.margin.profitAfterVat} € ·{" "}
                  {order.margin.marginPercent ?? "—"}%
                </dd>
              </div>
              <div>
                <dt>{t("business.vat_balance")}</dt>
                <dd>{order.margin.vatBalance} €</dd>
              </div>
            </dl>
          )}
          <RecordWorkflow entityId={order.id} entityType="ORDER" />
          <BusinessHistory entityId={order.id} entityType="ORDER" />
        </article>
      ))}
      {cursor && (
        <Button
          onClick={async () => {
            try {
              const { data } = await api.get("/purchase-orders", {
                params: { supplierId, customerId, recordId, cursor },
              });
              setOrders((old) => [...old, ...data.data]);
              setCursor(data.nextCursor);
            } catch {
              toast.error(t("tasks.failed"));
            }
          }}
        >
          {t("tasks.more")}
        </Button>
      )}
      {supplierId && (
        <Link to="/purchase-orders">{t("workflow.all_orders")}</Link>
      )}
    </div>
  );
}

function retainSelected<T extends { id: string; name: string }>(
  rows: T[],
  old: T[],
  id: string
): T[] {
  const selected = old.find((row) => row.id === id);
  return selected && !rows.some((row) => row.id === id)
    ? [selected, ...rows]
    : rows;
}
