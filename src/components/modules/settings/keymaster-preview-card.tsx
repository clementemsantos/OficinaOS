import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import KeymasterActiveJobsCard from "@/components/modules/settings/keymaster-active-jobs-card";
import KeymasterArchiveBrowser from "@/components/modules/settings/keymaster-archive-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";
import {
  type KeymasterEntity,
  type KeymasterPreview,
  previewKeymasterFile,
  readKeymasterArchive,
} from "@/lib/keymaster-import";

const ENTITY_KEYS: Record<KeymasterEntity, string> = {
  customers: "data_io.keymaster_customers",
  equipment: "data_io.keymaster_equipment",
  suppliers: "data_io.keymaster_suppliers",
  services: "data_io.keymaster_services",
  stock: "data_io.keymaster_stock",
};

const ENTITIES: KeymasterEntity[] = [
  "customers",
  "equipment",
  "suppliers",
  "services",
  "stock",
];

interface ArchiveStatus {
  counts: Record<KeymasterEntity, number>;
  total: number;
}

interface ChunkResult {
  conflicts: number;
  stored: number;
  unchanged: number;
}

const CHUNK_SIZE = 50;

export default function KeymasterPreviewCard() {
  const { t } = useTranslation();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<KeymasterPreview[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [archiveStatus, setArchiveStatus] = useState<ArchiveStatus | null>(
    null
  );
  const [importResult, setImportResult] = useState<ChunkResult | null>(null);
  const [importProgress, setImportProgress] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState("");
  const [syncedStatus, setSyncedStatus] = useState<ArchiveStatus | null>(null);
  const [syncResult, setSyncResult] = useState<{
    created: number;
    errors: number;
  } | null>(null);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    fileName: string;
  } | null>(null);

  const refreshArchiveStatus = useCallback(async () => {
    const response = await api.get<ArchiveStatus>("/import/keymaster/status");
    setArchiveStatus(response.data);
  }, []);

  const refreshSyncedStatus = useCallback(async () => {
    const response = await api.get<ArchiveStatus>(
      "/import/keymaster/sync-status"
    );
    setSyncedStatus(response.data);
  }, []);

  useEffect(() => {
    refreshSyncedStatus().catch(() => setSyncedStatus(null));
  }, [refreshSyncedStatus]);

  useEffect(() => {
    refreshArchiveStatus().catch(() => {
      // The preview still works if the optional archive API isn't installed.
      setArchiveStatus(null);
    });
  }, [refreshArchiveStatus]);

  const onFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selected.length === 0 || busy || importing) {
      return;
    }
    setBusy(true);
    setFiles(selected);
    setPreviews([]);
    setErrors([]);
    setImportResult(null);
    const next: KeymasterPreview[] = [];
    const problems: string[] = [];
    try {
      for (const [index, file] of selected.entries()) {
        setProgress({
          current: index + 1,
          total: selected.length,
          fileName: file.name,
        });
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        try {
          next.push(await previewKeymasterFile(file));
        } catch (error) {
          problems.push(
            `${file.name}: ${error instanceof Error ? error.message : t("data_io.import_failed")}`
          );
        }
        setPreviews([...next]);
        setErrors([...problems]);
      }
    } finally {
      setProgress(null);
      setBusy(false);
    }
  };

  const canImport =
    files.length > 0 &&
    previews.length === files.length &&
    errors.length === 0 &&
    previews.every(
      (preview) =>
        preview.missingReferences === 0 && preview.duplicateReferences === 0
    );

  const importArchive = async () => {
    if (!canImport || busy || importing) {
      return;
    }
    setImporting(true);
    setImportResult(null);
    const summary: ChunkResult = { stored: 0, unchanged: 0, conflicts: 0 };
    try {
      for (const [fileIndex, file] of files.entries()) {
        setImportProgress(
          t("data_io.keymaster_import_progress", {
            current: fileIndex + 1,
            total: files.length,
            file: file.name,
          })
        );
        const archive = await readKeymasterArchive(file);
        for (
          let index = 0;
          index < archive.records.length;
          index += CHUNK_SIZE
        ) {
          const response = await api.post<ChunkResult>(
            "/import/keymaster/archive",
            {
              entity: archive.entity,
              sourceFile: archive.sourceFile,
              headers: archive.headers,
              records: archive.records.slice(index, index + CHUNK_SIZE),
            }
          );
          summary.stored += response.data.stored;
          summary.unchanged += response.data.unchanged;
          summary.conflicts += response.data.conflicts;
        }
      }
      setImportResult(summary);
      if (summary.conflicts > 0) {
        toast.warning(
          t("data_io.keymaster_conflicts", {
            count: summary.conflicts,
          })
        );
      } else {
        toast.success(t("data_io.keymaster_import_success"));
      }
    } catch (error) {
      setErrors((old) => [
        ...old,
        error instanceof Error
          ? error.message
          : t("data_io.keymaster_import_failed"),
      ]);
      toast.error(t("data_io.keymaster_import_failed"));
    } finally {
      setImporting(false);
      setImportProgress("");
      refreshArchiveStatus().catch(() => setArchiveStatus(null));
    }
  };

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: sequential per-entity sync with explicit stop conditions
  const applyToModules = async () => {
    if (syncing || importing || busy || !archiveStatus?.total) {
      return;
    }
    setSyncing(true);
    setSyncResult(null);
    let created = 0;
    let errors = 0;
    try {
      for (const entity of ENTITIES) {
        const count = archiveStatus.counts[entity] ?? 0;
        if (count === 0) {
          continue;
        }
        for (let attempt = 0; attempt <= Math.ceil(count / 25); attempt++) {
          setSyncProgress(
            t("data_io.keymaster_sync_progress", {
              entity: t(ENTITY_KEYS[entity]),
              created,
            })
          );
          const response = await api.post<{
            created: number;
            errors: { reference: string; reason: string }[];
            remaining: number;
          }>("/import/keymaster/sync", { entity });
          created += response.data.created;
          errors += response.data.errors.length;
          if (response.data.remaining === 0) {
            break;
          }
          if (
            response.data.created === 0 &&
            response.data.errors.length === 0
          ) {
            throw new Error("A sincronização não está a avançar.");
          }
        }
      }
      setSyncResult({ created, errors });
      if (errors > 0) {
        toast.warning(t("data_io.keymaster_sync_warnings", { count: errors }));
      } else {
        toast.success(t("data_io.keymaster_sync_success"));
      }
    } catch {
      toast.error(t("data_io.keymaster_sync_failed"));
    } finally {
      setSyncing(false);
      setSyncProgress("");
      refreshArchiveStatus().catch(() => setArchiveStatus(null));
      refreshSyncedStatus().catch(() => setSyncedStatus(null));
    }
  };

  return (
    <div className="rounded-xl bg-surface-container-lowest p-5">
      <h3 className="font-bold text-on-surface text-sm">
        {t("data_io.keymaster_title")}
      </h3>
      <p className="mt-2 text-on-surface-variant text-sm">
        {t("data_io.keymaster_preview_desc")}
      </p>
      <Input
        accept=".xlsx"
        className="hidden"
        multiple
        onChange={onFiles}
        ref={fileInput}
        type="file"
      />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          disabled={importing}
          icon="upload"
          loading={busy}
          onClick={() => fileInput.current?.click()}
          size="sm"
          type="button"
          variant="secondary"
        >
          {t("data_io.keymaster_pick_files")}
        </Button>
        {canImport && (
          <Button
            disabled={busy}
            loading={importing}
            onClick={importArchive}
            size="sm"
            type="button"
          >
            {t("data_io.keymaster_import_archive")}
          </Button>
        )}
      </div>
      {progress && (
        <p aria-live="polite" className="mt-3 text-on-surface-variant text-sm">
          {t("data_io.keymaster_progress", {
            current: progress.current,
            total: progress.total,
            file: progress.fileName,
          })}
        </p>
      )}
      {importProgress && (
        <p aria-live="polite" className="mt-3 text-on-surface-variant text-sm">
          {importProgress}
        </p>
      )}
      {previews.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-outline-variant border-b text-on-surface-variant">
                <th className="py-2 pe-3">{t("data_io.keymaster_file")}</th>
                <th className="py-2 pe-3">{t("data_io.keymaster_type")}</th>
                <th className="py-2 pe-3">{t("data_io.keymaster_rows")}</th>
                <th className="py-2 pe-3">{t("data_io.keymaster_issues")}</th>
              </tr>
            </thead>
            <tbody>
              {previews.map((preview) => (
                <tr
                  className="border-outline-variant border-b"
                  key={preview.fileName}
                >
                  <td className="max-w-52 break-words py-2 pe-3">
                    {preview.fileName}
                  </td>
                  <td className="py-2 pe-3">
                    {t(ENTITY_KEYS[preview.entity])}
                  </td>
                  <td className="py-2 pe-3">{preview.recordCount}</td>
                  <td className="py-2 pe-3">
                    {preview.missingReferences > 0 &&
                      `${t("data_io.keymaster_missing_refs")}: ${preview.missingReferences}; `}
                    {preview.duplicateReferences > 0 &&
                      `${t("data_io.keymaster_duplicate_refs")}: ${preview.duplicateReferences}; `}
                    {preview.missingCustomerLinks > 0 &&
                      `${t("data_io.keymaster_missing_links")}: ${preview.missingCustomerLinks}; `}
                    {preview.missingPrices > 0 &&
                      `${t("data_io.keymaster_missing_prices")}: ${preview.missingPrices}; `}
                    {preview.missingReferences === 0 &&
                      preview.duplicateReferences === 0 &&
                      preview.missingCustomerLinks === 0 &&
                      preview.missingPrices === 0 &&
                      t("data_io.keymaster_no_warnings")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {importResult && (
        <p aria-live="polite" className="mt-3 text-sm">
          {t("data_io.keymaster_import_result", {
            stored: importResult.stored,
            unchanged: importResult.unchanged,
            conflicts: importResult.conflicts,
          })}
        </p>
      )}
      {errors.length > 0 && (
        <div aria-live="polite" className="mt-3 text-error text-sm">
          {errors.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}
      {archiveStatus && (
        <div className="mt-4 rounded-lg border border-outline-variant p-3">
          <p className="font-semibold text-on-surface text-sm">
            {t("data_io.keymaster_archived_total", {
              count: archiveStatus.total,
            })}
          </p>
          <p className="mt-2 text-on-surface-variant text-xs">
            {ENTITIES.map(
              (entity) =>
                `${t(ENTITY_KEYS[entity])}: ${archiveStatus.counts[entity] ?? 0}`
            ).join(" · ")}
          </p>
        </div>
      )}
      {archiveStatus?.total ? (
        <div className="mt-4 rounded-lg border border-outline-variant p-3">
          <h4 className="font-semibold text-on-surface text-sm">
            {t("data_io.keymaster_sync_title")}
          </h4>
          <p className="mt-2 text-on-surface-variant text-xs">
            {t("data_io.keymaster_sync_explanation")}
          </p>
          <div className="mt-3">
            <Button
              disabled={busy || importing}
              loading={syncing}
              onClick={applyToModules}
              size="sm"
              type="button"
            >
              {t("data_io.keymaster_sync_action")}
            </Button>
          </div>
          {syncProgress && (
            <p aria-live="polite" className="mt-2 text-on-surface text-sm">
              {syncProgress}
            </p>
          )}
          {syncedStatus && (
            <p className="mt-2 text-on-surface-variant text-xs">
              {t("data_io.keymaster_synced_count", {
                count: syncedStatus.total,
                total: archiveStatus.total,
              })}
            </p>
          )}
          {syncResult && (
            <p className="mt-2 text-on-surface text-sm">
              {t("data_io.keymaster_sync_result", syncResult)}
            </p>
          )}
        </div>
      ) : null}
      <KeymasterArchiveBrowser />
      <KeymasterActiveJobsCard />
      <p className="mt-4 text-on-surface-variant text-xs">
        {t("data_io.keymaster_safe_notice")}
      </p>
    </div>
  );
}
