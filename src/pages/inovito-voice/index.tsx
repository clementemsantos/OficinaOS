import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useCan } from "@/hooks/use-can";
import api from "@/lib/api";

interface VoiceCall {
  id: string;
  callerPhone: string;
  calledPhone: string | null;
  status: string;
  durationSeconds: number | null;
  summary: string | null;
  startedAt: string;
  customer: { id: string; name: string } | null;
}

interface ExcludedNumber {
  id: string;
  phone: string;
}

function localDate(value: string): string {
  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Lisbon",
  }).format(new Date(value));
}

export default function InovitoVoicePage() {
  const { t } = useTranslation();
  const canViewExclusions = useCan({ settings: ["view"] });
  const canEditExclusions = useCan({ settings: ["edit"] });
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [exclusions, setExclusions] = useState<ExcludedNumber[]>([]);
  const [number, setNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [callsResponse, exclusionsResponse] = await Promise.all([
        api.get<{ calls: VoiceCall[] }>("/inovito-voice/calls"),
        canViewExclusions
          ? api.get<{ numbers: ExcludedNumber[] }>("/inovito-voice/exclusions")
          : Promise.resolve(null),
      ]);
      setCalls(callsResponse.data.calls);
      if (exclusionsResponse) {
        setExclusions(exclusionsResponse.data.numbers);
      }
    } catch {
      toast.error(t("inovito_voice.load_error"));
    } finally {
      setLoading(false);
    }
  }, [canViewExclusions, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function addExclusion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!number.trim()) {
      return;
    }
    setBusy(true);
    try {
      await api.post("/inovito-voice/exclusions", { phone: number.trim() });
      setNumber("");
      toast.success(t("inovito_voice.exclusion_saved"));
      await refresh();
    } catch {
      toast.error(t("inovito_voice.exclusion_error"));
    } finally {
      setBusy(false);
    }
  }

  async function removeExclusion(id: string) {
    setBusy(true);
    try {
      await api.delete(`/inovito-voice/exclusions/${encodeURIComponent(id)}`);
      toast.success(t("inovito_voice.exclusion_removed"));
      await refresh();
    } catch {
      toast.error(t("inovito_voice.exclusion_error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-extrabold font-headline text-2xl text-on-surface md:text-3xl">
            {t("inovito_voice.title")}
          </h2>
          <p className="mt-1 text-on-surface-variant">
            {t("inovito_voice.subtitle")}
          </p>
        </div>
        <button
          className="rounded-xl border border-outline-variant px-4 py-2 font-semibold text-sm hover:bg-surface-container"
          onClick={() => void refresh()}
          type="button"
        >
          {t("inovito_voice.refresh")}
        </button>
      </header>

      <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
        <p className="font-semibold text-on-surface">
          {t("inovito_voice.not_connected")}
        </p>
        <p className="mt-1 text-on-surface-variant text-sm">
          {t("inovito_voice.not_connected_desc")}
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="font-bold text-lg">{t("inovito_voice.calls")}</h3>
        {loading ? (
          <p className="text-on-surface-variant">{t("inovito_voice.loading")}</p>
        ) : calls.length === 0 ? (
          <p className="rounded-xl bg-surface-container-low p-4 text-on-surface-variant">
            {t("inovito_voice.no_calls")}
          </p>
        ) : (
          <div className="space-y-3">
            {calls.map((call) => (
              <article
                className="rounded-xl border border-outline-variant p-4"
                key={call.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{call.customer?.name ?? call.callerPhone}</p>
                  <span className="rounded-lg bg-surface-container px-3 py-1 text-xs">
                    {t(`inovito_voice.status_${call.status}`, call.status)}
                  </span>
                </div>
                <p className="mt-1 text-on-surface-variant text-xs">
                  {localDate(call.startedAt)} · {call.callerPhone} · {call.durationSeconds ?? 0}s
                </p>
                {call.summary ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm">{call.summary}</p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      {canViewExclusions ? (
        <section className="space-y-3">
          <div>
            <h3 className="font-bold text-lg">
              {t("inovito_voice.exclusions")}
            </h3>
            <p className="text-on-surface-variant text-sm">
              {t("inovito_voice.exclusions_explanation")}
            </p>
          </div>

          {canEditExclusions ? (
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(event) => void addExclusion(event)}
            >
              <input
                aria-label={t("inovito_voice.number")}
                className="min-w-0 flex-1 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2"
                onChange={(event) => setNumber(event.target.value)}
                placeholder={t("inovito_voice.number")}
                type="tel"
                value={number}
              />
              <button
                className="rounded-xl bg-primary px-4 py-2 font-bold text-on-primary disabled:opacity-50"
                disabled={busy || !number.trim()}
                type="submit"
              >
                {t("inovito_voice.exclude")}
              </button>
            </form>
          ) : null}

          <div className="space-y-2">
            {exclusions.length === 0 ? (
              <p className="text-on-surface-variant text-sm">
                {t("inovito_voice.no_exclusions")}
              </p>
            ) : (
              exclusions.map((item) => (
                <div
                  className="flex items-center justify-between gap-2 rounded-xl border border-outline-variant p-3"
                  key={item.id}
                >
                  <span className="font-mono text-sm">{item.phone}</span>
                  {canEditExclusions ? (
                    <button
                      className="rounded-lg px-3 py-2 text-error text-sm hover:bg-error-container disabled:opacity-50"
                      disabled={busy}
                      onClick={() => void removeExclusion(item.id)}
                      type="button"
                    >
                      {t("inovito_voice.remove")}
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
