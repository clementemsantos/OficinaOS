import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { DocumentPanel } from "@/components/modules/documents/document-panel";
import api from "@/lib/api";
export default function DocumentsPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Record<string, string | null>>({});
  useEffect(() => {
    api
      .get("/online-backup")
      .then(({ data }) => setStatus(data))
      .catch(() => setStatus({}));
  }, []);
  return (
    <div className="space-y-4">
      <h1 className="font-bold text-2xl">{t("documents.library")}</h1>
      <section className="space-y-2 rounded-xl bg-surface-container p-4">
        <h2 className="font-bold">{t("integrations.backup_title")}</h2>
        <p>{t("integrations.backup_hint")}</p>
        {["local", "remote", "failure"].map((key) => (
          <p key={key}>
            {t(`integrations.backup_${key}`)}:{" "}
            {status[key] ? new Date(status[key]).toLocaleString() : "—"}
          </p>
        ))}
      </section>
      <DocumentPanel entityId="library" entityType="GENERAL" />
    </div>
  );
}
