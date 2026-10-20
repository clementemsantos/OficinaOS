import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";

interface Connection {
  enabled: boolean;
  kind: string;
  lastError: string | null;
  lastSyncAt: string | null;
}
export function IntegrationPanel({
  kind,
  onSynced,
}: {
  kind: "WOOCOMMERCE" | "EMAIL";
  onSynced: () => void;
}) {
  const { t } = useTranslation();
  const [connection, setConnection] = useState<Connection>();
  const [automaticAvailable, setAutomaticAvailable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({
    since: new Date().toISOString().slice(0, 10),
    folder: "INBOX",
  });
  const refresh = useCallback(async () => {
    const { data } = await api.get("/integrations");
    const found = data.data.find((row: Connection) => row.kind === kind);
    setAutomaticAvailable(data.automaticAvailable !== false);
    setConnection(found);
    setEnabled(found?.enabled ?? false);
  }, [kind]);
  useEffect(() => {
    refresh().catch(() => toast.error(t("tasks.failed")));
  }, [refresh, t]);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const { since, ...rest } = values;
      await api.put(`/integrations/${kind}`, {
        enabled,
        settings: {
          ...rest,
          since: new Date(`${since}T00:00:00Z`).toISOString(),
          ...(kind === "EMAIL" ? { port: 993 } : {}),
        },
      });
      setValues({ since, folder: "INBOX" });
      await refresh();
      toast.success(t("save"));
    } catch {
      toast.error(t("tasks.failed"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-3 rounded-xl bg-surface-container p-4">
      <h2 className="font-bold">{t(`integrations.${kind}`)}</h2>
      {!automaticAvailable && <p>{t("integrations.auto_server_disabled")}</p>}
      <p>
        {t(
          kind === "EMAIL" ? "integrations.email_hint" : "integrations.woo_hint"
        )}
      </p>
      {connection && (
        <>
          <p>
            {t("integrations.last_sync")}:{" "}
            {connection.lastSyncAt
              ? new Date(connection.lastSyncAt).toLocaleString()
              : "—"}
          </p>
          {connection.lastError && (
            <p role="alert">{t(connection.lastError)}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const { data } = await api.post(
                    `/integrations/${kind}/sync`,
                    {},
                    { timeout: 10 * 60_000 }
                  );
                  toast.success(
                    t("integrations.imported", { count: data.imported })
                  );
                  await refresh();
                  onSynced();
                } catch {
                  toast.error(t("integrations.failed"));
                  await refresh();
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t("integrations.sync")}
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api.patch(`/integrations/${kind}`, {
                    enabled: !connection.enabled,
                  });
                  await refresh();
                } catch {
                  toast.error(t("tasks.failed"));
                } finally {
                  setBusy(false);
                }
              }}
              variant="secondary"
            >
              {t(
                connection.enabled
                  ? "integrations.pause"
                  : "integrations.enable"
              )}
            </Button>
          </div>
        </>
      )}
      <details>
        <summary className="cursor-pointer">
          {t("integrations.configure")}
        </summary>
        <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={save}>
          {(kind === "EMAIL"
            ? ["host", "user", "password", "folder", "since"]
            : ["url", "key", "secret", "since"]
          ).map((name) => (
            <Field key={name} label={t(`integrations.${name}`)}>
              <Input
                autoComplete="off"
                disabled={busy}
                maxLength={1000}
                onChange={(event) =>
                  setValues((old) => ({ ...old, [name]: event.target.value }))
                }
                required
                type={fieldType(name)}
                value={values[name] ?? ""}
              />
            </Field>
          ))}
          <Field horizontal label={t("integrations.auto")}>
            <Checkbox
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
          </Field>
          <p className="text-sm">{t("integrations.replace_hint")}</p>
          <Button loading={busy} type="submit">
            {t("save")}
          </Button>
        </form>
      </details>
    </section>
  );
}

function fieldType(name: string) {
  if (["password", "secret", "key"].includes(name)) {
    return "password";
  }
  if (name === "since") {
    return "date";
  }
  return name === "url" ? "url" : "text";
}
