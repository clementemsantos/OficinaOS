import type { PurchaseOrderView } from "@shared/types/purchase-order";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { IntegrationPanel } from "@/components/modules/documents/integration-panel";
import { OrderEditor } from "@/components/modules/orders/order-editor";
import { OrderLinesTable } from "@/components/modules/orders/order-lines-table";
import { RecordWorkflow } from "@/components/modules/tasks/record-workflow";
import { Button } from "@/components/ui/button";
import { useCan } from "@/hooks/use-can";
import { useFormatCurrency } from "@/hooks/use-format-currency";
import api from "@/lib/api";
import { BusinessHistory } from "@/pages/business/history";
import { OrdersTable } from "./orders-table";

const HTTP_URL = /^https?:/;
export default function PurchaseOrdersPage() {
  const { t } = useTranslation();
  const integrationAdmin = useCan({
    settings: ["edit"],
    parts: ["manageCatalog", "viewCost"],
  });
  const failure = t("tasks.failed");
  const fmt = useFormatCurrency();
  const [params, setParams] = useSearchParams();
  const recordId = params.get("recordId") || undefined;
  const supplierId = params.get("supplierId") || undefined;
  const customerId = params.get("customerId") || undefined;
  const financial = useCan({ parts: ["viewCost"] });
  const edit = useCan({ parts: ["manageCatalog", "viewCost"] });
  const [orders, setOrders] = useState<PurchaseOrderView[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [editing, setEditing] = useState<PurchaseOrderView | null | undefined>(
    undefined
  );
  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/purchase-orders", {
        params: { supplierId, customerId, recordId },
      });
      setOrders(data.data);
      setCursor(data.nextCursor);
    } catch {
      toast.error(failure);
    }
  }, [supplierId, customerId, recordId, failure]);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-bold text-2xl">{t("workflow.orders")}</h1>
        {edit && (
          <Button onClick={() => setEditing(null)}>
            {t("order_lines.new_order")}
          </Button>
        )}
      </div>
      {integrationAdmin && (
        <details>
          <summary className="cursor-pointer font-semibold">
            {t("integrations.WOOCOMMERCE")}
          </summary>
          <IntegrationPanel kind="WOOCOMMERCE" onSynced={() => load()} />
        </details>
      )}
      {edit && editing !== undefined && (
        <OrderEditor
          customerId={customerId}
          key={editing?.id ?? "new"}
          onClose={() => setEditing(undefined)}
          onSaved={(id) => {
            setEditing(undefined);
            if (recordId && recordId !== id) {
              setParams({ recordId: id });
            } else {
              load();
            }
          }}
          order={editing}
          supplierId={supplierId}
        />
      )}
      {!orders.length && <p>{t("workflow.no_orders")}</p>}
      {!recordId && <OrdersTable financial={financial} orders={orders} />}
      {recordId &&
        orders.map((order) => (
          <article
            className="space-y-3 rounded-2xl bg-surface-container-low p-5"
            key={order.id}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold text-lg">
                <Link
                  className="hover:underline"
                  to={`/purchase-orders?recordId=${order.id}`}
                >
                  {order.number
                    ? `EN-${String(order.number).padStart(6, "0")} · `
                    : ""}
                  {order.title}
                </Link>
              </h2>
              {edit && (
                <Button
                  onClick={() => {
                    setEditing(order);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  variant="secondary"
                >
                  {t("edit")}
                </Button>
              )}
            </div>
            <p>
              {[
                order.customer?.name,
                order.supplier?.name,
                order.reference,
                new Date(order.createdAt).toLocaleDateString(),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <OrderLinesTable financial={financial} lines={order.lines} />
            {financial && order.costsComplete === false && (
              <p>
                {t("integrations.cost_missing")} ·{" "}
                {t("order_lines.total_quote")}: {fmt(Number(order.quoteGross))}
              </p>
            )}
            {financial && order.margin && (
              <dl className="grid gap-3 sm:grid-cols-4">
                <div>
                  <dt>{t("order_lines.total_cost")}</dt>
                  <dd className="font-bold">{fmt(Number(order.costGross))}</dd>
                </div>
                <div>
                  <dt>{t("order_lines.total_quote")}</dt>
                  <dd className="font-bold">{fmt(Number(order.quoteGross))}</dd>
                </div>
                <div>
                  <dt>{t("business.margin")}</dt>
                  <dd className="font-bold">
                    {fmt(Number(order.margin.profitAfterVat))} ·{" "}
                    {order.margin.marginPercent ?? "—"}%
                  </dd>
                </div>
                <div>
                  <dt>{t("business.vat_balance")}</dt>
                  <dd>{fmt(Number(order.margin.vatBalance))}</dd>
                </div>
              </dl>
            )}
            <p className="whitespace-pre-wrap">{order.notes}</p>
            {order.jobId && (
              <Link
                className="text-primary underline"
                to={`/jobs/${order.jobId}`}
              >
                {order.job?.jobCode ?? t("business.fields.jobId")}
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
              toast.error(failure);
            }
          }}
        >
          {t("tasks.more")}
        </Button>
      )}
      {(supplierId || recordId || customerId) && (
        <Link to="/purchase-orders">{t("workflow.all_orders")}</Link>
      )}
    </div>
  );
}
