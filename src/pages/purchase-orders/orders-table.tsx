import type { PurchaseOrderView } from "@shared/types/purchase-order";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useFormatCurrency } from "@/hooks/use-format-currency";

export function OrdersTable({
  orders,
  financial,
}: {
  orders: PurchaseOrderView[];
  financial: boolean;
}) {
  const { t } = useTranslation();
  const fmt = useFormatCurrency();
  const columns = [
    "reference",
    "title",
    "status",
    "customer",
    "supplier",
    "date",
    ...(financial ? ["cost", "quote", "margin"] : []),
    "open",
  ];
  return (
    <div className="overflow-x-auto rounded-xl bg-surface-container-low">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {columns.map((column) => (
              <th className="p-3" key={column}>
                {t(`orders_list.${column}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const href = `/purchase-orders?recordId=${encodeURIComponent(order.id)}`;
            return (
              <tr className="border-outline-variant border-b" key={order.id}>
                <td className="p-3 font-semibold">
                  <Link className="text-primary underline" to={href}>
                    {order.number
                      ? `EN-${String(order.number).padStart(6, "0")}`
                      : order.reference || "—"}
                  </Link>
                </td>
                <td className="p-3">
                  <Link className="hover:underline" to={href}>
                    {order.title}
                  </Link>
                  {order.reference && (
                    <p className="text-on-surface-variant text-xs">
                      {order.reference}
                    </p>
                  )}
                </td>
                <td className="p-3">
                  <span className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary text-xs">
                    {order.workflowState?.name ?? t("workflow.no_status")}
                  </span>
                </td>
                <td className="p-3">{order.customer?.name ?? "—"}</td>
                <td className="p-3">{order.supplier?.name ?? "—"}</td>
                <td className="p-3">
                  {new Date(order.createdAt).toLocaleDateString()}
                </td>
                {financial && (
                  <>
                    <td className="p-3">
                      {order.costsComplete === false
                        ? t("integrations.cost_missing")
                        : fmt(Number(order.costGross ?? 0))}
                    </td>
                    <td className="p-3 font-semibold">
                      {fmt(Number(order.quoteGross ?? 0))}
                    </td>
                    <td className="p-3">
                      {order.margin ? (
                        <>
                          {fmt(Number(order.margin.profitAfterVat))} ·{" "}
                          {order.margin.marginPercent ?? "—"}%
                        </>
                      ) : (
                        t("integrations.cost_missing")
                      )}
                    </td>
                  </>
                )}
                <td className="p-3">
                  <Link className="text-primary underline" to={href}>
                    {t("orders_list.open")}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
