import { type ChangeEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type KeymasterEntity,
  type KeymasterPreview,
  previewKeymasterFile,
} from "@/lib/keymaster-import";

const ENTITY_KEYS: Record<KeymasterEntity, string> = {
  customers: "data_io.keymaster_customers",
  equipment: "data_io.keymaster_equipment",
  suppliers: "data_io.keymaster_suppliers",
  services: "data_io.keymaster_services",
  stock: "data_io.keymaster_stock",
};

/**
 * Read-only staging preview. The full records remain inside the browser;
 * importing them needs the audited, provenance-aware migration workflow.
 */
export default function KeymasterPreviewCard() {
  const { t } = useTranslation();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [previews, setPreviews] = useState<KeymasterPreview[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    fileName: string;
  } | null>(null);

  const onFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0 || busy) {
      return;
    }
    setBusy(true);
    setPreviews([]);
    setErrors([]);
    const next: KeymasterPreview[] = [];
    const problems: string[] = [];
    try {
      for (const [index, file] of files.entries()) {
        setProgress({
          current: index + 1,
          total: files.length,
          fileName: file.name,
        });
        // Give the browser an opportunity to paint the file currently being
        // checked before the parsing library performs any synchronous work.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        try {
          next.push(await previewKeymasterFile(file));
        } catch (error) {
          problems.push(
            `${file.name}: ${error instanceof Error ? error.message : t("data_io.import_failed")}`
          );
        }
        // Show each result immediately instead of waiting for ALL five files.
        setPreviews([...next]);
        setErrors([...problems]);
      }
    } finally {
      setProgress(null);
      setBusy(false);
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
      <div className="mt-4">
        <Button
          icon="upload"
          loading={busy}
          onClick={() => fileInput.current?.click()}
          size="sm"
          type="button"
          variant="secondary"
        >
          {t("data_io.keymaster_pick_files")}
        </Button>
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
      {errors.length > 0 && (
        <div aria-live="polite" className="mt-3 text-error text-sm">
          {errors.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}
      <p className="mt-4 text-on-surface-variant text-xs">
        {t("data_io.keymaster_safe_notice")}
      </p>
    </div>
  );
}
