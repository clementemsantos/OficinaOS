import { cents, money } from "@shared/business-finance";
import type { OrderLineView } from "@shared/types/purchase-order";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useFormatCurrency } from "@/hooks/use-format-currency";

const HTTP_URL = /^https?:/;
export function OrderLinesTable({
  lines,
  financial,
  onEdit,
  onRemove,
}: {
  lines: readonly OrderLineView[];
  financial: boolean;
  onEdit?: (index: number) => void;
  onRemove?: (index: number) => void;
}) {
  const { t } = useTranslation();
  const fmt = useFormatCurrency();
  if (!lines.length) {
    return <p className="text-on-surface-variant">{t("order_lines.empty")}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-outline-variant border-b">
            <th className="p-3">{t("order_lines.description")}</th>
            <th className="p-3">{t("catalog.quantity")}</th>
            {financial && (
              <>
                <th className="p-3">{t("order_lines.costGross")}</th>
                <th className="p-3">{t("order_lines.quoteGross")}</th>
                <th className="p-3">{t("order_lines.saleVatRate")}</th>
                <th className="p-3">{t("order_lines.line_total")}</th>
              </>
            )}
            {(onEdit || onRemove) && <th className="p-3">{t("actions")}</th>}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr
              className="border-outline-variant border-b"
              key={line.id ?? index}
            >
              <td className="p-3">
                <p className="font-medium">{line.name}</p>
                <p className="text-on-surface-variant text-xs">
                  {[line.reference, line.supplier?.name]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {line.purchaseUrl && HTTP_URL.test(line.purchaseUrl) && (
                  <a
                    className="text-primary underline"
                    href={line.purchaseUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {t("business.fields.purchaseUrl")}
                  </a>
                )}
              </td>
              <td className="p-3">{line.quantity}</td>
              {financial && (
                <>
                  <td className="p-3">
                    {line.costKnown === false
                      ? t("integrations.cost_missing")
                      : fmt(Number(line.costGross ?? 0))}
                  </td>
                  <td className="p-3">{fmt(Number(line.quoteGross ?? 0))}</td>
                  <td className="p-3">{line.saleVatRate}%</td>
                  <td className="p-3 font-bold">
                    {fmt(
                      Number(
                        money(
                          cents(line.quoteGross ?? "0") * BigInt(line.quantity)
                        )
                      )
                    )}
                  </td>
                </>
              )}
              {(onEdit || onRemove) && (
                <td className="p-3">
                  <div className="flex gap-2">
                    {onEdit && (
                      <Button
                        aria-label={`${t("edit")} ${line.name}`}
                        onClick={() => onEdit(index)}
                        size="sm"
                        variant="ghost"
                      >
                        {t("edit")}
                      </Button>
                    )}
                    {onRemove && (
                      <Button
                        aria-label={`${t("delete")} ${line.name}`}
                        onClick={() => onRemove(index)}
                        size="sm"
                        variant="destructive-soft"
                      >
                        {t("delete")}
                      </Button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
