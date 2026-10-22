import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { JobCodePicker } from "@/components/modules/catalog/job-code-picker";
import { PartPicker } from "@/components/modules/catalog/part-picker";
import { SupplierPicker } from "@/components/modules/catalog/supplier-picker";
import { RmaDeductionControl } from "@/components/modules/rmas/rma-deduction-control";
import { RecordWorkflow } from "@/components/modules/tasks/record-workflow";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCan } from "@/hooks/use-can";
import api from "@/lib/api";

interface Supplier {
  id: string;
  name: string;
}

interface Part {
  id: string;
  name: string;
}

interface Rma {
  createdAt: string;
  deductedAmount?: string | number | null;
  deductedAt?: string | null;
  deductedSaleItem?: { sale: { saleCode: string } } | null;
  deductionReversedAt?: string | null;
  description: string;
  id: string;
  job?: { id: string; jobCode: string } | null;
  part: Part | null;
  quantity: number;
  reason: string | null;
  reference: string | null;
  resolvedAt: string | null;
  sentAt: string | null;
  status: string;
  supplier: Supplier | null;
  updatedAt: string;
}

const STATUSES = ["OPEN", "SENT", "RECEIVED", "RESOLVED", "CANCELLED"];

function optionalRmaField(value: string, editing: boolean, cleared: null | "") {
  return value.trim() || (editing ? cleared : undefined);
}

export function RmaModal({
  jobCode,
  editing,
  onClose,
  onSaved,
}: {
  jobCode: string;
  editing?: Rma;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    supplierId: editing?.supplier?.id ?? "",
    jobCode: editing?.job?.jobCode ?? jobCode,
    partId: editing?.part?.id ?? "",
    description: editing?.description ?? "",
    quantity: String(editing?.quantity ?? 1),
    reference: editing?.reference ?? "",
    reason: editing?.reason ?? "",
  });
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof form>) =>
    setForm((p) => ({ ...p, ...patch }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!(form.supplierId && form.description.trim()) || busy) {
      return;
    }
    setBusy(true);
    try {
      const payload = {
        supplierId: form.supplierId,
        jobCode: optionalRmaField(form.jobCode, !!editing, null),
        partId: optionalRmaField(form.partId, !!editing, null),
        description: form.description.trim(),
        quantity: Number.parseInt(form.quantity, 10) || 1,
        reference: optionalRmaField(form.reference, !!editing, ""),
        reason: optionalRmaField(form.reason, !!editing, ""),
      };
      if (editing) {
        await api.patch(`/supplier-rmas/${editing.id}`, payload);
      } else {
        await api.post("/supplier-rmas", payload);
      }
      toast.success(t("rmas.saved"));
      onSaved();
      onClose();
    } catch {
      toast.error(t("rmas.save_failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-end sm:items-center sm:justify-center"
      role="dialog"
    >
      <button
        aria-label={t("close_modal")}
        className="absolute inset-0 bg-overlay"
        onClick={onClose}
        type="button"
      />
      <div className="modal-surface relative z-10 flex max-h-[85vh] w-full flex-col overflow-hidden rounded-b-none bg-surface-container-lowest shadow-2xl sm:max-h-[80vh] sm:max-w-md sm:rounded-xl">
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="font-bold font-headline text-lg text-on-surface">
            {editing ? t("edit") : t("rmas.add")}
          </h2>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full text-outline hover:bg-surface-container-high"
            onClick={onClose}
            type="button"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form
          className="flex-1 space-y-4 overflow-y-auto p-6"
          onSubmit={submit}
        >
          <Field label={t("rmas.supplier")} required>
            <SupplierPicker
              onChange={(id) => set({ supplierId: id })}
              value={form.supplierId}
            />
          </Field>
          <Field label={t("rmas.job_code")}>
            <JobCodePicker
              onChange={(code) => set({ jobCode: code })}
              value={form.jobCode}
            />
          </Field>
          <Field label={t("rmas.part")}>
            <PartPicker
              initialPart={editing?.part}
              onChange={(id) => set({ partId: id })}
              value={form.partId}
            />
          </Field>
          <Field label={t("rmas.description")} required>
            <Input
              onChange={(e) => set({ description: e.target.value })}
              placeholder={t("rmas.description_placeholder")}
              required
              value={form.description}
            />
          </Field>
          <Field label={t("rmas.quantity")}>
            <Input
              min={1}
              onChange={(e) => set({ quantity: e.target.value })}
              type="number"
              value={form.quantity}
            />
          </Field>
          <Field label={t("rmas.reference")}>
            <Input
              onChange={(e) => set({ reference: e.target.value })}
              value={form.reference}
            />
          </Field>
          <Field label={t("rmas.reason")}>
            <Textarea
              onChange={(e) => set({ reason: e.target.value })}
              rows={3}
              value={form.reason}
            />
          </Field>
          <Button
            className="w-full"
            loading={busy}
            size="lg"
            type="submit"
            variant="primary-gradient"
          >
            {t("save")}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function SupplierRmasPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const jobId = params.get("jobId") || undefined;
  const jobCode = params.get("jobCode") || "";
  const [rmas, setRmas] = useState<Rma[]>([]);
  const canEdit = useCan({ parts: ["manageCatalog"] });
  const [editing, setEditing] = useState<Rma | undefined>();
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r] = await Promise.allSettled([
        api.get("/supplier-rmas", {
          params: { status: statusFilter || undefined, jobId },
        }),
      ]);
      if (r.status === "fulfilled") {
        setRmas(r.value.data?.data ?? []);
      }
      if (r.status === "rejected") {
        toast.error(t("rmas.load_failed"));
      }
    } catch {
      toast.error(t("rmas.load_failed"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, jobId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (rma: Rma, status: string) => {
    try {
      await api.patch(`/supplier-rmas/${rma.id}`, { status });
      load();
    } catch (err) {
      const code = (err as { code?: string }).code;
      toast.error(
        t(
          code === "INVALID_TRANSITION"
            ? "errors.invalid_transition"
            : "rmas.save_failed"
        )
      );
    }
  };

  return (
    <>
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-extrabold font-headline text-2xl text-on-surface tracking-tight md:text-3xl">
            {t("rmas.title")}
          </h2>
          <p className="mt-1 font-medium text-on-surface-variant text-sm md:text-base">
            {t("rmas.desc")}
          </p>
        </div>
        <Button
          disabled={!canEdit}
          icon="add"
          onClick={() => {
            setEditing(undefined);
            setShowModal(true);
          }}
          size="md"
          type="button"
          variant="primary-gradient"
        >
          {t("rmas.add")}
        </Button>
      </div>

      <div className="mb-5 sm:w-64">
        <Select
          aria-label={t("rmas.filter_status")}
          onChange={(e) => setStatusFilter(e.target.value)}
          value={statusFilter}
        >
          <option value="">{t("rmas.all_statuses")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`rmas.status_${s.toLowerCase()}`)}
            </option>
          ))}
        </Select>
      </div>

      <div className="overflow-hidden rounded-2xl bg-surface-container-low">
        {loading && (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div
                className="h-14 animate-pulse rounded-xl bg-surface-container-high"
                key={i}
              />
            ))}
          </div>
        )}
        {!(loading || rmas.length > 0) && (
          <div className="flex flex-col items-center justify-center py-16">
            <Icon
              className="text-on-surface-variant"
              name="assignment_return"
              size="xl"
            />
            <p className="mt-3 font-bold font-headline text-lg text-on-surface">
              {t("rmas.empty")}
            </p>
          </div>
        )}
        {!loading && rmas.length > 0 && (
          <ul className="divide-y divide-outline-variant/30">
            {rmas.map((rma) => (
              <li
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                key={rma.id}
              >
                <div className="min-w-0 flex-1">
                  <RmaDeductionControl onSaved={load} rma={rma} />
                  <RecordWorkflow entityId={rma.id} entityType="RMA" />
                  {rma.job && (
                    <Link
                      className="text-primary text-sm underline"
                      to={`/jobs/${rma.job.id}`}
                    >
                      {rma.job.jobCode}
                    </Link>
                  )}
                  <p className="truncate font-bold text-on-surface text-sm">
                    {rma.description}
                    <span className="ml-2 font-normal text-on-surface-variant">
                      ×{rma.quantity}
                    </span>
                  </p>
                  <p className="truncate text-on-surface-variant text-xs">
                    {[
                      rma.supplier?.name,
                      rma.part?.name,
                      rma.reference,
                      new Date(rma.createdAt).toLocaleDateString(),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {canEdit && (
                  <Button
                    onClick={() => {
                      setEditing(rma);
                      setShowModal(true);
                    }}
                    variant="ghost"
                  >
                    {t("edit")}
                  </Button>
                )}
                <Select
                  aria-label={t("rmas.status")}
                  className="sm:w-44"
                  disabled={!canEdit}
                  onChange={(e) => setStatus(rma, e.target.value)}
                  value={rma.status}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`rmas.status_${s.toLowerCase()}`)}
                    </option>
                  ))}
                </Select>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showModal && (
        <RmaModal
          editing={editing}
          jobCode={jobCode}
          onClose={() => setShowModal(false)}
          onSaved={load}
        />
      )}
    </>
  );
}
