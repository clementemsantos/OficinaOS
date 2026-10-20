import {
  WORKFLOW_PERMISSIONS,
  type WorkflowType,
} from "@shared/constants/workflow";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCan } from "@/hooks/use-can";
import api from "@/lib/api";

interface DocumentRow {
  id: string;
  name: string;
  size: number;
}
export function DocumentPanel({
  entityType,
  entityId,
}: {
  entityType: WorkflowType;
  entityId: string;
}) {
  const { t } = useTranslation();
  const admin = useCan({ settings: ["edit"] });
  const edit = useCan(WORKFLOW_PERMISSIONS[entityType].edit);
  const canEdit = entityType === "GENERAL" ? admin : edit;
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [library, setLibrary] = useState<DocumentRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [libraryCursor, setLibraryCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const params = { entityType, entityId };
  const load = useCallback(
    async (next?: string) => {
      try {
        const { data } = await api.get("/documents", {
          params: { entityType, entityId, cursor: next },
        });
        setRows((old) => (next ? [...old, ...data.data] : data.data));
        setCursor(data.nextCursor);
      } catch {
        toast.error(t("tasks.failed"));
      }
    },
    [entityType, entityId, t]
  );
  useEffect(() => {
    load();
  }, [load]);
  const download = async (row: DocumentRow) => {
    try {
      const { data } = await api.get(`/documents/${row.id}/download`, {
        params,
        responseType: "blob",
      });
      const url = URL.createObjectURL(data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = row.name;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error(t("tasks.failed"));
    }
  };
  return (
    <section className="my-3 space-y-3 rounded-xl border border-outline-variant p-4">
      <h3 className="font-semibold">{t("documents.title")}</h3>
      <p className="text-sm">{t("documents.hint")}</p>
      {canEdit && (
        <Input
          aria-label={t("documents.upload")}
          disabled={busy}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) {
              return;
            }
            if (file.size > 5 * 1024 * 1024) {
              toast.error(t("documents.limit"));
              return;
            }
            setBusy(true);
            try {
              const body = new FormData();
              body.append("file", file);
              await api.post("/documents", body, { params });
              await load();
            } catch {
              toast.error(t("tasks.failed"));
            } finally {
              setBusy(false);
            }
          }}
          type="file"
        />
      )}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li className="flex flex-wrap items-center gap-3" key={row.id}>
            <Button onClick={() => download(row)} size="sm" variant="ghost">
              {row.name} ({Math.ceil(row.size / 1024)} KB)
            </Button>
            {canEdit && (
              <Button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api.delete(`/documents/${row.id}/link`, { params });
                    await load();
                  } catch {
                    toast.error(t("tasks.failed"));
                  } finally {
                    setBusy(false);
                  }
                }}
                size="sm"
                variant="ghost"
              >
                {t("documents.unlink")}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {cursor && (
        <Button onClick={() => load(cursor)}>{t("tasks.more")}</Button>
      )}
      {canEdit && admin && entityType !== "GENERAL" && (
        <details
          onToggle={async (event) => {
            if (!event.currentTarget.open) {
              return;
            }
            try {
              const { data } = await api.get("/documents", {
                params: { entityType: "GENERAL", entityId: "library" },
              });
              setLibrary(data.data);
              setLibraryCursor(data.nextCursor);
            } catch {
              toast.error(t("tasks.failed"));
            }
          }}
        >
          <summary className="cursor-pointer">
            {t("documents.from_library")}
          </summary>
          {library
            .filter((row) => !rows.some((item) => item.id === row.id))
            .map((row) => (
              <Button
                disabled={busy}
                key={row.id}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api.post(`/documents/${row.id}/link`, {
                      from: { entityType: "GENERAL", entityId: "library" },
                      to: params,
                    });
                    await load();
                  } catch {
                    toast.error(t("tasks.failed"));
                  } finally {
                    setBusy(false);
                  }
                }}
                variant="ghost"
              >
                {row.name}
              </Button>
            ))}
          {libraryCursor && (
            <Button
              onClick={async () => {
                try {
                  const { data } = await api.get("/documents", {
                    params: {
                      entityType: "GENERAL",
                      entityId: "library",
                      cursor: libraryCursor,
                    },
                  });
                  setLibrary((old) => [...old, ...data.data]);
                  setLibraryCursor(data.nextCursor);
                } catch {
                  toast.error(t("tasks.failed"));
                }
              }}
            >
              {t("tasks.more")}
            </Button>
          )}
        </details>
      )}
    </section>
  );
}
