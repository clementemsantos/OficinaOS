import { PAYMENT_METHODS } from "@shared/constants/payment-methods";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useCan } from "@/hooks/use-can";
import { useFormatCurrency } from "@/hooks/use-format-currency";
import api from "@/lib/api";
import { createRequestId } from "@/lib/request-id";

import {
  type CustomPaymentMethod,
  PaymentMethodManager,
} from "./payment-method-manager";

interface QuoteSnapshot {
  lines: {
    id: string;
    name: string;
    quantity: number;
    quoteGross: string;
    saleVatRate: string;
  }[];
  status: string;
  title: string;
  total: string;
}
interface Finance {
  balance: string;
  methods?: CustomPaymentMethod[];
  paid: string;
  payments: {
    id: string;
    method: string;
    customMethodName?: string | null;
    amount: string;
    reference: string | null;
    note: string | null;
    createdAt: string;
    voidedAt: string | null;
    voidReason: string | null;
    createdBy: { name: string; username: string };
  }[];
  quoteDecidedAt: string | null;
  quoteStatus: string;
  quotes?: { id: string; createdAt: string; metadata: QuoteSnapshot }[];
  total: string;
  updatedAt: string;
}
export function OrderFinance({
  id,
  onChanged,
}: {
  id: string;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const fmt = useFormatCurrency();
  const canView = useCan({
    parts: ["viewCatalog", "viewCost"],
    payments: ["view"],
  });
  const canPay = useCan({ payments: ["create"] });
  const canVoid = useCan({ payments: ["delete"] });
  const canQuote = useCan({ parts: ["manageCatalog"] });
  const [data, setData] = useState<Finance | null>(null);
  const [busy, setBusy] = useState(false);
  const requestKey = useRef(createRequestId());
  const load = useCallback(async () => {
    if (!canView) {
      return;
    }
    try {
      const response = await api.get(`/purchase-orders/${id}/finance`);
      setData(response.data.data);
    } catch {
      toast.error(t("tasks.failed"));
    }
  }, [canView, id, t]);
  useEffect(() => {
    load();
  }, [load]);
  const save = async (path: string, payload: object) => {
    setBusy(true);
    try {
      await api.post(`/purchase-orders/${id}/${path}`, payload);
      await load();
      onChanged();
      requestKey.current = createRequestId();
      toast.success(t("order_finance.saved"));
    } catch {
      toast.error(t("order_finance.failed"));
    } finally {
      setBusy(false);
    }
  };
  if (!(canView && data)) {
    return null;
  }
  return (
    <section className="space-y-4 rounded-xl border border-outline-variant p-4">
      <h2 className="font-bold text-lg">{t("order_finance.title")}</h2>
      <p>{t("order_finance.manual_hint")}</p>
      <PaymentMethodManager methods={data.methods ?? []} onChanged={load} />
      <dl className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ["total", data.total],
            ["paid", data.paid],
            ["balance", data.balance],
          ] as const
        ).map(([key, value]) => (
          <div key={key}>
            <dt>{t(`order_finance.${key}`)}</dt>
            <dd className="font-bold text-xl">{fmt(Number(value))}</dd>
          </div>
        ))}
      </dl>
      <p>
        {t(`order_finance.${data.quoteStatus}`)}
        {data.quoteDecidedAt
          ? ` · ${new Date(data.quoteDecidedAt).toLocaleString()}`
          : ""}
      </p>
      {canQuote && (
        <form
          className="flex flex-wrap items-end gap-3"
          key={data.updatedAt}
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            save("quote", {
              status: form.get("status"),
              expectedUpdatedAt: data.updatedAt,
            });
          }}
        >
          <label htmlFor={`quote-status-${id}`}>
            {t("order_finance.quote_status")}
            <Select
              defaultValue={data.quoteStatus}
              disabled={busy}
              id={`quote-status-${id}`}
              name="status"
            >
              {["DRAFT", "SENT", "ACCEPTED", "REJECTED"].map((status) => (
                <option key={status} value={status}>
                  {t(`order_finance.${status}`)}
                </option>
              ))}
            </Select>
          </label>
          <Button disabled={busy} type="submit">
            {t("order_finance.save_status")}
          </Button>
        </form>
      )}
      {canPay && data.quoteStatus !== "ACCEPTED" && (
        <p>{t("order_finance.accept_first")}</p>
      )}
      {canPay &&
        data.quoteStatus === "ACCEPTED" &&
        Number(data.balance) > 0 && (
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              save("payments", {
                method: String(form.get("method")).startsWith("CUSTOM:")
                  ? "OTHER"
                  : form.get("method"),
                customMethodId: String(form.get("method")).startsWith("CUSTOM:")
                  ? String(form.get("method")).slice(7)
                  : undefined,
                amount: Number(String(form.get("amount")).replace(",", ".")),
                reference: form.get("reference"),
                note: form.get("note"),
                requestKey: requestKey.current,
                expectedUpdatedAt: data.updatedAt,
              });
            }}
          >
            <label htmlFor={`order-amount-${id}`}>
              {t("order_finance.amount")}
              <Input
                disabled={busy}
                id={`order-amount-${id}`}
                max={data.balance}
                min="0.01"
                name="amount"
                required
                step="0.01"
                type="number"
              />
            </label>
            <label htmlFor={`order-method-${id}`}>
              {t("order_finance.method")}
              <Select disabled={busy} id={`order-method-${id}`} name="method">
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {t(`payment_method.${method}`)}
                  </option>
                ))}
                {(data.methods ?? [])
                  .filter((method) => method.isActive)
                  .map((method) => (
                    <option key={method.id} value={`CUSTOM:${method.id}`}>
                      {method.name}
                    </option>
                  ))}
              </Select>
            </label>
            <label htmlFor={`order-reference-${id}`}>
              {t("order_finance.reference")}
              <Input
                disabled={busy}
                id={`order-reference-${id}`}
                maxLength={100}
                name="reference"
              />
            </label>
            <label htmlFor={`order-note-${id}`}>
              {t("order_finance.note")}
              <Input
                disabled={busy}
                id={`order-note-${id}`}
                maxLength={500}
                name="note"
              />
            </label>
            <Button disabled={busy} type="submit">
              {t("order_finance.record")}
            </Button>
          </form>
        )}
      {!!data.quotes?.length && (
        <details>
          <summary className="cursor-pointer font-semibold">
            {t("order_finance.quote_history")}
          </summary>
          {data.quotes.map((quote) => (
            <details
              className="my-3 rounded-lg bg-surface-container-low p-3"
              key={quote.id}
            >
              <summary>
                {new Date(quote.createdAt).toLocaleString()} ·{" "}
                {t(`order_finance.${quote.metadata.status}`)} ·{" "}
                {fmt(Number(quote.metadata.total))}
              </summary>
              <p>{quote.metadata.title}</p>
              {quote.metadata.lines.map((line) => (
                <p key={line.id}>
                  {line.name} × {line.quantity} · {fmt(Number(line.quoteGross))}{" "}
                  · {t("order_finance.vat")}: {line.saleVatRate}%
                </p>
              ))}
            </details>
          ))}
        </details>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {["date", "method", "amount", "reference", "note"].map((key) => (
                <th className="p-2" key={key}>
                  {t(`order_finance.${key}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.payments.map((payment) => (
              <tr className="border-outline-variant border-b" key={payment.id}>
                <td className="p-2">
                  {new Date(payment.createdAt).toLocaleString()}
                  <p>{payment.createdBy.name || payment.createdBy.username}</p>
                </td>
                <td className="p-2">
                  {payment.customMethodName ??
                    t(`payment_method.${payment.method}`)}
                </td>
                <td className="p-2">
                  {fmt(Number(payment.amount))}
                  {payment.voidedAt && (
                    <p>
                      {t("order_finance.voided")} · {payment.voidReason}
                    </p>
                  )}
                </td>
                <td className="p-2">{payment.reference}</td>
                <td className="p-2">
                  {payment.note}
                  {canVoid && !payment.voidedAt && (
                    <form
                      className="mt-2 flex gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        save(`payments/${payment.id}/void`, {
                          reason: new FormData(event.currentTarget).get(
                            "reason"
                          ),
                        });
                      }}
                    >
                      <Input
                        aria-label={t("order_finance.reason")}
                        disabled={busy}
                        maxLength={500}
                        minLength={3}
                        name="reason"
                        placeholder={t("order_finance.reason")}
                        required
                      />
                      <Button disabled={busy} type="submit" variant="secondary">
                        {t("order_finance.void")}
                      </Button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
