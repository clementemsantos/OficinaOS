import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useFormatCurrency } from "@/hooks/use-format-currency";
import api from "@/lib/api";
import { type Campaign, type Lead, MarketingEditor, STAGES } from "./editor";
export default function MarketingPage() {
  const { t } = useTranslation();
  const fmt = useFormatCurrency();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [cursors, setCursors] = useState<{
    campaigns: string | null;
    leads: string | null;
  }>({ campaigns: null, leads: null });
  const [filter, setFilter] = useState({ q: "", stage: "" });
  const [editing, setEditing] = useState<{
    kind: "campaigns" | "leads";
    row: Campaign | Lead | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [campaignResult, leadResult] = await Promise.all([
        api.get("/marketing/campaigns", {
          params: { q: filter.q || undefined },
        }),
        api.get("/marketing/leads", {
          params: {
            q: filter.q || undefined,
            stage: filter.stage || undefined,
          },
        }),
      ]);
      setCampaigns(campaignResult.data.data);
      setLeads(leadResult.data.data);
      setCursors({
        campaigns: campaignResult.data.nextCursor,
        leads: leadResult.data.nextCursor,
      });
    } catch {
      toast.error(t("marketing.failed"));
    } finally {
      setBusy(false);
    }
  }, [filter, t]);
  useEffect(() => {
    load();
  }, [load]);
  const more = async (kind: "campaigns" | "leads") => {
    setBusy(true);
    try {
      const { data } = await api.get(`/marketing/${kind}`, {
        params: {
          q: filter.q || undefined,
          ...(kind === "leads" && filter.stage ? { stage: filter.stage } : {}),
          cursor: cursors[kind],
        },
      });
      if (kind === "campaigns") {
        setCampaigns((old) => [...old, ...data.data]);
      } else {
        setLeads((old) => [...old, ...data.data]);
      }
      setCursors((old) => ({ ...old, [kind]: data.nextCursor }));
    } catch {
      toast.error(t("marketing.failed"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-6">
      <h1 className="font-bold text-2xl">{t("marketing.title")}</h1>
      <p className="rounded-xl bg-primary/10 p-4">
        {t("marketing.manual_hint")}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setEditing({ kind: "campaigns", row: null })}>
          {t("marketing.new_campaign")}
        </Button>
        <Button
          onClick={() => setEditing({ kind: "leads", row: null })}
          variant="secondary"
        >
          {t("marketing.new_lead")}
        </Button>
        <a
          className="text-primary underline"
          href="https://ads.google.com/"
          rel="noopener noreferrer"
          target="_blank"
        >
          Google Ads
        </a>
        <a
          className="text-primary underline"
          href="https://adsmanager.facebook.com/"
          rel="noopener noreferrer"
          target="_blank"
        >
          Meta Ads
        </a>
      </div>
      {editing && (
        <MarketingEditor
          campaigns={campaigns}
          key={`${editing.kind}-${editing.row?.id ?? "new"}`}
          kind={editing.kind}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
          row={editing.row}
        />
      )}
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setFilter({
            q: String(data.get("q") ?? ""),
            stage: String(data.get("stage") ?? ""),
          });
        }}
      >
        <label htmlFor="marketing-search">
          {t("marketing.search")}
          <Input id="marketing-search" maxLength={100} name="q" />
        </label>
        <label htmlFor="marketing-stage">
          {t("marketing.stage")}
          <Select id="marketing-stage" name="stage">
            <option value="">{t("marketing.all")}</option>
            {STAGES.map((value) => (
              <option key={value} value={value}>
                {t(`marketing.${value}`)}
              </option>
            ))}
          </Select>
        </label>
        <Button disabled={busy} type="submit">
          {t("orders_list.filter")}
        </Button>
      </form>
      <section className="space-y-3">
        <h2 className="font-bold text-xl">{t("marketing.campaigns")}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {[
                  "name",
                  "channel",
                  "status",
                  "budget",
                  "spend",
                  "leads",
                  "won",
                  "cpl",
                  "roas",
                  "edit",
                ].map((key) => (
                  <th className="p-2" key={key}>
                    {t(`marketing.${key}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((row) => (
                <tr className="border-outline-variant border-b" key={row.id}>
                  <td className="p-2">{row.name}</td>
                  <td className="p-2">{t(`marketing.${row.channel}`)}</td>
                  <td className="p-2">{t(`marketing.${row.status}`)}</td>
                  <td className="p-2">{fmt(Number(row.budget))}</td>
                  <td className="p-2">{fmt(Number(row.spend))}</td>
                  <td className="p-2">{row.leadCount}</td>
                  <td className="p-2">{row.wonCount}</td>
                  <td className="p-2">
                    {row.costPerLead ? fmt(Number(row.costPerLead)) : "—"}
                  </td>
                  <td className="p-2">
                    {row.estimatedRoas ? `${row.estimatedRoas}×` : "—"}
                  </td>
                  <td className="p-2">
                    <Button
                      onClick={() => setEditing({ kind: "campaigns", row })}
                      variant="ghost"
                    >
                      {t("edit")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!campaigns.length && <p>{t("marketing.empty")}</p>}
        {cursors.campaigns && (
          <Button disabled={busy} onClick={() => more("campaigns")}>
            {t("marketing.more_campaigns")}
          </Button>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="font-bold text-xl">{t("marketing.leads")}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {[
                  "lead_title",
                  "customer",
                  "campaign",
                  "stage",
                  "value",
                  "followUpDate",
                  "edit",
                ].map((key) => (
                  <th className="p-2" key={key}>
                    {t(`marketing.${key}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((row) => (
                <tr className="border-outline-variant border-b" key={row.id}>
                  <td className="p-2">{row.title}</td>
                  <td className="p-2">{row.customer?.name ?? "—"}</td>
                  <td className="p-2">{row.campaign?.name ?? "—"}</td>
                  <td className="p-2">{t(`marketing.${row.stage}`)}</td>
                  <td className="p-2">{fmt(Number(row.value))}</td>
                  <td className="p-2">{row.followUpDate ?? "—"}</td>
                  <td className="p-2">
                    <Button
                      onClick={() => setEditing({ kind: "leads", row })}
                      variant="ghost"
                    >
                      {t("edit")}
                    </Button>
                    {row.customerId && (
                      <Link
                        className="text-primary underline"
                        to={`/purchase-orders?customerId=${encodeURIComponent(row.customerId)}`}
                      >
                        {t("workflow.orders")}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!leads.length && <p>{t("marketing.empty")}</p>}
        {cursors.leads && (
          <Button disabled={busy} onClick={() => more("leads")}>
            {t("marketing.more_leads")}
          </Button>
        )}
      </section>
      <p className="text-on-surface-variant text-sm">
        {t("marketing.metrics_hint")}
      </p>
    </div>
  );
}
