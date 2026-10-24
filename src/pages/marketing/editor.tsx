import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CustomerPicker } from "@/components/modules/catalog/customer-picker";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import api from "@/lib/api";
export interface Campaign {
  budget: string;
  channel: string;
  costPerLead: string | null;
  endDate: string | null;
  estimatedRevenue: string;
  estimatedRoas: string | null;
  id: string;
  landingUrl: string;
  leadCount: number;
  name: string;
  objective: string;
  spend: string;
  startDate: string | null;
  status: string;
  updatedAt: string;
  wonCount: number;
}
export interface Lead {
  campaign: { id: string; name: string } | null;
  campaignId: string | null;
  customer: { id: string; name: string } | null;
  customerId: string | null;
  followUpDate: string | null;
  id: string;
  notes: string;
  stage: string;
  title: string;
  updatedAt: string;
  value: string;
}
export const CHANNELS = [
  "GOOGLE_ADS",
  "META_ADS",
  "EMAIL",
  "WHATSAPP",
  "SMS",
  "OTHER",
];
export const STAGES = ["NEW", "QUALIFIED", "QUOTE_SENT", "WON", "LOST"];
export function MarketingEditor({
  kind,
  row,
  campaigns,
  onSaved,
  onClose,
}: {
  kind: "campaigns" | "leads";
  row: Campaign | Lead | null;
  campaigns: Campaign[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const campaign = kind === "campaigns";
  const [values, setValues] = useState<Record<string, string>>(() => {
    if (row) {
      return Object.fromEntries(
        Object.entries(row)
          .filter(([, value]) => typeof value === "string" || value === null)
          .map(([key, value]) => [key, String(value ?? "")])
      );
    }
    if (campaign) {
      return {
        name: "",
        channel: "GOOGLE_ADS",
        status: "DRAFT",
        objective: "",
        budget: "0",
        spend: "0",
        startDate: "",
        endDate: "",
        landingUrl: "",
      };
    }
    return {
      title: "",
      customerId: "",
      campaignId: "",
      stage: "NEW",
      value: "0",
      followUpDate: "",
      notes: "",
    };
  });
  const [busy, setBusy] = useState(false);
  const set = (key: string, value: string) =>
    setValues((old) => ({ ...old, [key]: value }));
  const selected = row && "campaign" in row ? row.campaign : null;
  const options =
    selected && !campaigns.some((item) => item.id === selected.id)
      ? [selected, ...campaigns]
      : campaigns;
  return (
    <form
      className="space-y-4 rounded-xl bg-surface-container-low p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        const fields = campaign
          ? [
              "name",
              "channel",
              "status",
              "objective",
              "budget",
              "spend",
              "startDate",
              "endDate",
              "landingUrl",
            ]
          : [
              "title",
              "customerId",
              "campaignId",
              "stage",
              "value",
              "followUpDate",
              "notes",
            ];
        const nullable = new Set([
          "customerId",
          "campaignId",
          "startDate",
          "endDate",
          "followUpDate",
        ]);
        const data = Object.fromEntries(
          fields.map((key) => [
            key,
            nullable.has(key) && !values[key] ? null : values[key],
          ])
        );
        try {
          if (row) {
            await api.patch(`/marketing/${kind}/${row.id}`, {
              ...data,
              expectedUpdatedAt: row.updatedAt,
            });
          } else {
            await api.post(`/marketing/${kind}`, data);
          }
          toast.success(t("marketing.saved"));
          onSaved();
        } catch {
          toast.error(t("marketing.failed"));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="font-bold text-lg">
        {t(campaign ? "marketing.campaign" : "marketing.lead")}
      </h2>
      <fieldset className="grid gap-3 sm:grid-cols-2" disabled={busy}>
        <Field label={t(campaign ? "marketing.name" : "marketing.lead_title")}>
          <Input
            maxLength={campaign ? 160 : 200}
            onChange={(event) =>
              set(campaign ? "name" : "title", event.target.value)
            }
            required
            value={values[campaign ? "name" : "title"]}
          />
        </Field>
        {campaign ? (
          <>
            <Field label={t("marketing.channel")}>
              <Select
                onChange={(event) => set("channel", event.target.value)}
                value={values.channel}
              >
                {CHANNELS.map((value) => (
                  <option key={value} value={value}>
                    {t(`marketing.${value}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("marketing.status")}>
              <Select
                onChange={(event) => set("status", event.target.value)}
                value={values.status}
              >
                {["DRAFT", "ACTIVE", "PAUSED", "ENDED"].map((value) => (
                  <option key={value} value={value}>
                    {t(`marketing.${value}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        ) : (
          <>
            <div>
              <p>{t("marketing.customer")}</p>
              <CustomerPicker
                onChange={(id) => set("customerId", id)}
                value={values.customerId}
              />
            </div>
            <Field label={t("marketing.campaign")}>
              <Select
                onChange={(event) => set("campaignId", event.target.value)}
                value={values.campaignId}
              >
                <option value="">{t("marketing.none")}</option>
                {options.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("marketing.stage")}>
              <Select
                onChange={(event) => set("stage", event.target.value)}
                value={values.stage}
              >
                {STAGES.map((value) => (
                  <option key={value} value={value}>
                    {t(`marketing.${value}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        )}
        {(campaign ? ["budget", "spend"] : ["value"]).map((key) => (
          <Field key={key} label={t(`marketing.${key}`)}>
            <Input
              max="9999999999.99"
              min="0"
              onChange={(event) => set(key, event.target.value)}
              required
              step="0.01"
              type="number"
              value={values[key]}
            />
          </Field>
        ))}
        {(campaign ? ["startDate", "endDate"] : ["followUpDate"]).map((key) => (
          <Field key={key} label={t(`marketing.${key}`)}>
            <Input
              onChange={(event) => set(key, event.target.value)}
              type="date"
              value={values[key]}
            />
          </Field>
        ))}
        {campaign && (
          <Field label={t("marketing.landingUrl")}>
            <Input
              onChange={(event) => set("landingUrl", event.target.value)}
              type="url"
              value={values.landingUrl}
            />
          </Field>
        )}
        <Field label={t(campaign ? "marketing.objective" : "marketing.notes")}>
          <Textarea
            maxLength={campaign ? 4000 : 8000}
            onChange={(event) =>
              set(campaign ? "objective" : "notes", event.target.value)
            }
            value={values[campaign ? "objective" : "notes"]}
          />
        </Field>
      </fieldset>
      <div className="flex gap-3">
        <Button disabled={busy} type="submit">
          {t("save")}
        </Button>
        <Button disabled={busy} onClick={onClose} variant="secondary">
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
