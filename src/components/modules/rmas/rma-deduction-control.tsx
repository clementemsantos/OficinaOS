import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useCan } from "@/hooks/use-can";
import { useFormatCurrency } from "@/hooks/use-format-currency";
import api from "@/lib/api";

interface DeductibleRma {
  deductedAmount?: string | number | null;
  deductedAt?: string | null;
  deductedSaleItem?: { sale: { saleCode: string } } | null;
  deductionReversedAt?: string | null;
  id: string;
  job?: { jobCode: string } | null;
  quantity: number;
  status: string;
  updatedAt: string;
}
interface Candidate {
  amount: string;
  available: number;
  id: string;
  name: string;
  quantity: number;
}
export function RmaDeductionControl({
  rma,
  onSaved,
}: {
  rma: DeductibleRma;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const fmt = useFormatCurrency();
  const viewAmounts = useCan({ parts: ["viewCost"] });
  const financial = useCan({ parts: ["manageCatalog", "viewCost"] });
  const canJob = useCan({ jobs: ["edit"] });
  const canSale = useCan({ sales: ["create"] });
  const [kind, setKind] = useState(
    rma.deductedSaleItem || !canJob ? "SALE" : "JOB"
  );
  const [reference, setReference] = useState(
    rma.job?.jobCode ?? rma.deductedSaleItem?.sale.saleCode ?? ""
  );
  const [lines, setLines] = useState<Candidate[]>([]);
  const [lineId, setLineId] = useState("");
  const [busy, setBusy] = useState(false);
  const active = Boolean(rma.deductedAt && !rma.deductionReversedAt);
  const selected = lines.find((line) => line.id === lineId);
  const perform = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error(
        t(
          (error as { code?: string }).code === "ALREADY_INVOICED"
            ? "rma_discount.invoiced"
            : "rma_discount.failed"
        )
      );
    } finally {
      setBusy(false);
    }
  };
  const loadLines = () =>
    perform(async () => {
      setLines([]);
      setLineId("");
      const { data } = await api.get(
        `/supplier-rmas/${rma.id}/deduction-candidates`,
        { params: { kind, reference } }
      );
      setLines(data.data);
      if (data.data.length === 1) {
        setLineId(data.data[0].id);
      }
      if (!data.data.length) {
        toast.error(t("rma_discount.no_lines"));
      }
    });
  const apply = (event: FormEvent) => {
    event.preventDefault();
    if (!selected || busy) {
      return;
    }
    perform(async () => {
      await api.post(`/supplier-rmas/${rma.id}/deduct-piece`, {
        kind,
        reference,
        lineId,
        expectedUpdatedAt: rma.updatedAt,
      });
      setLines([]);
      setLineId("");
      onSaved();
      toast.success(t("rma_discount.applied"));
    });
  };
  return (
    <div className="my-2 space-y-2 text-sm">
      {active && (
        <p className="font-semibold text-primary">
          {t("rma_discount.applied")}
          {viewAmounts &&
            rma.deductedAmount != null &&
            `: ${fmt(Number(rma.deductedAmount))}`}
          {rma.deductedSaleItem && ` · ${rma.deductedSaleItem.sale.saleCode}`}
        </p>
      )}
      {active && <p>{t("rma_discount.payment_note")}</p>}
      {rma.deductionReversedAt && <p>{t("rma_discount.restored")}</p>}
      {financial && (canJob || canSale) && (
        <div className="space-y-2">
          {active ? (
            <Button
              disabled={busy}
              onClick={() =>
                perform(async () => {
                  await api.post(
                    `/supplier-rmas/${rma.id}/restore-piece-value`,
                    { expectedUpdatedAt: rma.updatedAt }
                  );
                  onSaved();
                  toast.success(t("rma_discount.restored"));
                })
              }
              size="sm"
              variant="secondary"
            >
              {t("rma_discount.restore")}
            </Button>
          ) : (
            <details>
              <summary className="cursor-pointer text-primary">
                {t("rma_discount.title")}
              </summary>
              <form className="mt-3 space-y-3" onSubmit={apply}>
                <p>{t("rma_discount.hint")}</p>
                <Field label={t("rma_discount.source")}>
                  <Select
                    disabled={Boolean(rma.job) || busy}
                    onChange={(event) => {
                      setKind(event.target.value);
                      setReference("");
                      setLines([]);
                      setLineId("");
                    }}
                    value={kind}
                  >
                    {canJob && (
                      <option value="JOB">{t("rma_discount.JOB")}</option>
                    )}
                    {canSale && (
                      <option value="SALE">{t("rma_discount.SALE")}</option>
                    )}
                  </Select>
                </Field>
                <Field label={t("rma_discount.reference")}>
                  <Input
                    disabled={busy}
                    maxLength={100}
                    onChange={(event) => {
                      setReference(event.target.value);
                      setLines([]);
                      setLineId("");
                    }}
                    value={reference}
                  />
                </Field>
                <Button
                  disabled={
                    busy || !reference.trim() || rma.status === "CANCELLED"
                  }
                  onClick={loadLines}
                  size="sm"
                >
                  {t("rma_discount.find")}
                </Button>
                {lines.length > 0 && (
                  <Field label={t("rma_discount.piece")}>
                    <Select
                      disabled={busy}
                      onChange={(event) => setLineId(event.target.value)}
                      value={lineId}
                    >
                      <option value="">{t("rma_discount.choose")}</option>
                      {lines.map((line) => (
                        <option key={line.id} value={line.id}>
                          {line.name} · {rma.quantity} {t("rma_discount.units")}{" "}
                          · {fmt(Number(line.amount))}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                {selected && (
                  <p className="font-bold">
                    {t("rma_discount.amount")}: {fmt(Number(selected.amount))}
                  </p>
                )}
                <Button disabled={!selected || busy} size="sm" type="submit">
                  {t("rma_discount.apply")}
                </Button>
              </form>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
