import type { RestockForecastDTO } from "@shared/types/reports";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import api from "@/lib/api";

type Tab = "retention" | "stock" | "warranties";
interface RetentionRow {
  id: string;
  jobs: number;
  lastActivity: string;
  messagingConsent: boolean;
  name: string;
  orders: number;
  sales: number;
}
interface WarrantyRow {
  customer: string;
  customerId: string;
  deliveredAt: string | null;
  expiresAt: string | null;
  id: string;
  jobCode: string;
  jobId: string;
  name: string;
}
const TABS: Tab[] = ["retention", "stock", "warranties"];
const STATES = ["EXPIRING", "ACTIVE", "EXPIRED", "UNKNOWN"];

export default function OperationsPage() {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<Tab>("retention");
  const [filter, setFilter] = useState({
    q: "",
    days: "180",
    state: "EXPIRING",
  });
  const [retention, setRetention] = useState<RetentionRow[]>([]);
  const [warranties, setWarranties] = useState<WarrantyRow[]>([]);
  const [forecast, setForecast] = useState<RestockForecastDTO | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const generation = useRef(0);
  const date = (value: string | null) =>
    value ? new Date(value).toLocaleDateString(i18n.language) : "—";
  const load = useCallback(
    async (after?: string) => {
      const request = ++generation.current;
      setBusy(true);
      setError(false);
      try {
        if (tab === "stock") {
          const { data } = await api.get<RestockForecastDTO>(
            "/parts/restock-forecast"
          );
          if (request !== generation.current) {
            return;
          }
          setForecast(data);
          setCursor(null);
        } else {
          const { data } = await api.get(`/operations/${tab}`, {
            params: {
              q: filter.q,
              cursor: after,
              ...(tab === "retention"
                ? { days: filter.days }
                : { state: filter.state }),
            },
          });
          if (request !== generation.current) {
            return;
          }
          if (tab === "retention") {
            setRetention((old) => (after ? [...old, ...data.data] : data.data));
          } else {
            setWarranties((old) =>
              after ? [...old, ...data.data] : data.data
            );
          }
          setCursor(data.nextCursor);
        }
      } catch {
        if (request === generation.current) {
          setError(true);
        }
      } finally {
        setBusy((old) => (request === generation.current ? false : old));
      }
    },
    [tab, filter]
  );
  useEffect(() => {
    setRetention([]);
    setWarranties([]);
    setForecast(null);
    setCursor(null);
    load();
    return () => {
      generation.current += 1;
    };
  }, [load]);
  const columns = {
    retention: [
      "customer",
      "last_activity",
      "jobs",
      "sales",
      "orders",
      "consent",
    ],
    stock: [
      "part",
      "stock_quantity",
      "supplier",
      "usage",
      "coverage",
      "suggested",
    ],
    warranties: ["job", "customer", "service", "delivered", "expires"],
  }[tab];
  const empty = {
    retention: !retention.length,
    stock: !forecast?.rows.length,
    warranties: !warranties.length,
  }[tab];
  return (
    <div className="space-y-6">
      <h1 className="font-bold text-2xl">{t("operations.title")}</h1>
      <fieldset
        aria-label={t("operations.title")}
        className="flex flex-wrap gap-2"
      >
        {TABS.map((value) => (
          <Button
            aria-pressed={tab === value}
            key={value}
            onClick={() => setTab(value)}
            variant={tab === value ? "primary" : "secondary"}
          >
            {t(`operations.${value}`)}
          </Button>
        ))}
      </fieldset>
      <p className="rounded-xl bg-primary/10 p-4">
        {t(`operations.${tab}_hint`)}
      </p>
      {tab === "stock" ? (
        <p>
          {t("operations.stock_summary", {
            parts: forecast?.summary.partsAtRisk ?? 0,
            quantity: forecast?.summary.totalSuggestedQuantity ?? 0,
          })}
        </p>
      ) : (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const values = new FormData(event.currentTarget);
            setFilter({
              q: String(values.get("q") ?? ""),
              days: String(values.get("days") ?? filter.days),
              state: String(values.get("state") ?? filter.state),
            });
          }}
        >
          <label htmlFor="operations-search">
            {t("marketing.search")}
            <Input id="operations-search" maxLength={100} name="q" />
          </label>
          {tab === "retention" ? (
            <label htmlFor="operations-days">
              {t("operations.days")}
              <Input
                defaultValue={filter.days}
                id="operations-days"
                max={3650}
                min={30}
                name="days"
                required
                type="number"
              />
            </label>
          ) : (
            <label htmlFor="operations-state">
              {t("marketing.status")}
              <Select
                defaultValue={filter.state}
                id="operations-state"
                name="state"
              >
                {STATES.map((state) => (
                  <option key={state} value={state}>
                    {t(`operations.${state}`)}
                  </option>
                ))}
              </Select>
            </label>
          )}
          <Button disabled={busy} type="submit">
            {t("orders_list.filter")}
          </Button>
        </form>
      )}
      {busy && <p role="status">{t("loading")}</p>}
      {error ? (
        <div role="alert">
          <p>{t("marketing.failed")}</p>
          <Button onClick={() => load()}>{t("operations.retry")}</Button>
        </div>
      ) : (
        !busy && empty && <p>{t("operations.empty")}</p>
      )}
      {!error && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th className="p-3" key={column}>
                    {t(`operations.${column}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tab === "retention" &&
                retention.map((row) => (
                  <tr className="border-outline-variant border-b" key={row.id}>
                    <td className="p-3">
                      <Link
                        className="text-primary underline"
                        to={`/customers/${encodeURIComponent(row.id)}`}
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="p-3">{date(row.lastActivity)}</td>
                    <td className="p-3">{row.jobs}</td>
                    <td className="p-3">{row.sales}</td>
                    <td className="p-3">{row.orders}</td>
                    <td className="p-3">
                      {t(
                        row.messagingConsent
                          ? "operations.consent_yes"
                          : "operations.consent_no"
                      )}
                    </td>
                  </tr>
                ))}
              {tab === "stock" &&
                forecast?.rows.map((row) => (
                  <tr
                    className="border-outline-variant border-b"
                    key={row.partId}
                  >
                    <td className="p-3">{row.partName}</td>
                    <td className="p-3">{row.stockQuantity}</td>
                    <td className="p-3">{row.supplier ?? "—"}</td>
                    <td className="p-3">{row.avgDailyUsage}</td>
                    <td className="p-3">{row.daysLeft ?? "—"}</td>
                    <td className="p-3">{row.suggestedQuantity}</td>
                  </tr>
                ))}
              {tab === "warranties" &&
                warranties.map((row) => (
                  <tr className="border-outline-variant border-b" key={row.id}>
                    <td className="p-3">
                      <Link
                        className="text-primary underline"
                        to={`/jobs/${encodeURIComponent(row.jobId)}`}
                      >
                        {row.jobCode}
                      </Link>
                    </td>
                    <td className="p-3">
                      <Link
                        className="text-primary underline"
                        to={`/customers/${encodeURIComponent(row.customerId)}`}
                      >
                        {row.customer}
                      </Link>
                    </td>
                    <td className="p-3">{row.name}</td>
                    <td className="p-3">{date(row.deliveredAt)}</td>
                    <td className="p-3">{date(row.expiresAt)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {cursor && !error && (
        <Button disabled={busy} onClick={() => load(cursor)}>
          {t("tasks.more")}
        </Button>
      )}
      <div className="flex flex-wrap gap-4">
        {[
          { to: "/marketing", label: "marketing.title" },
          { to: "/purchase-orders", label: "workflow.orders" },
          { to: "/returns", label: "returns_nav_label" },
        ].map((link) => (
          <Link className="text-primary underline" key={link.to} to={link.to}>
            {t(link.label)}
          </Link>
        ))}
      </div>
    </div>
  );
}
