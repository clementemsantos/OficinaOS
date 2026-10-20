import { orderLinesTotals } from "@shared/business-finance";
import {
  type OrderLineInput,
  orderLinesFields,
} from "@shared/schemas/order-lines";
import type { OrderLineView } from "@shared/types/purchase-order";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useFormatCurrency } from "@/hooks/use-format-currency";
import { orderLineInput } from "./order-line-data";
import { OrderLineDialog } from "./order-line-dialog";
import { OrderLinesTable } from "./order-lines-table";
export function OrderLinesEditor({
  lines,
  onChange,
  supplierId,
}: {
  lines: OrderLineView[];
  onChange: (lines: OrderLineView[]) => void;
  supplierId: string;
}) {
  const { t } = useTranslation();
  const fmt = useFormatCurrency();
  const [editing, setEditing] = useState<{
    index: number;
    line: OrderLineInput;
    part?: { id: string; name: string } | null;
  } | null>(null);
  const parsed = orderLinesFields.safeParse(lines.map(orderLineInput));
  const totals = parsed.success ? orderLinesTotals(parsed.data) : null;
  return (
    <section className="space-y-3 rounded-xl border border-outline-variant p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold text-lg">{t("order_lines.title")}</h2>
        <Button
          disabled={lines.length >= 100}
          onClick={() =>
            setEditing({
              index: -1,
              line: {
                name: "",
                quantity: 1,
                reference: "",
                partId: null,
                supplierId: supplierId || null,
                costGross: "0",
                quoteGross: "0",
                costVatRate: "0",
                saleVatRate: "0",
                recoverInputVat: true,
              },
            })
          }
        >
          {t("order_lines.add")}
        </Button>
      </div>
      <OrderLinesTable
        financial
        lines={lines}
        onEdit={(index) => {
          const { part, supplier: _supplier, ...line } = lines[index];
          setEditing({ index, part, line: orderLineInput(line) });
        }}
        onRemove={(index) =>
          onChange(lines.filter((_, position) => position !== index))
        }
      />
      {totals && (
        <dl className="grid gap-2 sm:grid-cols-3">
          <div>
            <dt>{t("order_lines.total_cost")}</dt>
            <dd className="font-bold">{fmt(Number(totals.costGross))}</dd>
          </div>
          <div>
            <dt>{t("order_lines.total_quote")}</dt>
            <dd className="font-bold">{fmt(Number(totals.quoteGross))}</dd>
          </div>
          <div>
            <dt>{t("business.margin")}</dt>
            <dd className="font-bold">
              {totals.costsComplete
                ? fmt(Number(totals.margin.profitAfterVat))
                : t("integrations.cost_missing")}{" "}
              {totals.costsComplete && (
                <>· {totals.margin.marginPercent ?? "—"}%</>
              )}
            </dd>
          </div>
        </dl>
      )}
      <p className="text-on-surface-variant text-sm">
        {t("order_lines.stock_hint")}
      </p>
      {editing &&
        createPortal(
          <OrderLineDialog
            applySupplierDefaults={editing.index < 0}
            initial={editing.line}
            onApply={(line) => {
              const next = {
                ...line,
                part:
                  line.partId === lines[editing.index]?.partId
                    ? lines[editing.index]?.part
                    : undefined,
              };
              onChange(
                editing.index < 0
                  ? [...lines, next]
                  : lines.map((old, index) =>
                      index === editing.index ? next : old
                    )
              );
              setEditing(null);
            }}
            onClose={() => setEditing(null)}
            part={
              editing.part ??
              (editing.line.partId
                ? { id: editing.line.partId, name: editing.line.name }
                : null)
            }
          />,
          document.body
        )}
    </section>
  );
}
