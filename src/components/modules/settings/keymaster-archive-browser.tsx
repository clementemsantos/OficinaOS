import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import api from "@/lib/api";
import type { KeymasterEntity } from "@/lib/keymaster-import";

interface ArchivedItem {
  headers: string[];
  id: string;
  sourceFile: string | null;
  sourceId: string;
  sourceRow: number;
  values: string[];
}

interface ArchivePage {
  entity: KeymasterEntity;
  items: ArchivedItem[];
  page: number;
  pageSize: number;
  total: number;
}

const ENTITIES: { entity: KeymasterEntity; label: string }[] = [
  { entity: "customers", label: "data_io.keymaster_customers" },
  { entity: "equipment", label: "data_io.keymaster_equipment" },
  { entity: "suppliers", label: "data_io.keymaster_suppliers" },
  { entity: "services", label: "data_io.keymaster_services" },
  { entity: "stock", label: "data_io.keymaster_stock" },
];

const NON_ALNUM = /[^A-Z0-9]/g;
const DIACRITICS = /[\u0300-\u036f]/g;

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toUpperCase()
    .replace(NON_ALNUM, "");
}

function summary(item: ArchivedItem, entity: KeymasterEntity): string {
  const keys: Record<KeymasterEntity, string[]> = {
    customers: ["NOME"],
    equipment: ["MARCA", "MODELO"],
    suppliers: ["NOME"],
    services: ["DESCRICAO"],
    stock: ["DESCRICAODAPECA"],
  };
  const byHeader = new Map(
    item.headers.map((header, index) => [
      normalize(header),
      String(item.values[index] ?? ""),
    ])
  );
  return (
    keys[entity]
      .map((key) => byHeader.get(key) || "")
      .filter(Boolean)
      .join(" · ") || "—"
  );
}

export default function KeymasterArchiveBrowser() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [entity, setEntity] = useState<KeymasterEntity>("customers");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ArchivePage | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError(false);
    try {
      const response = await api.get<ArchivePage>("/import/keymaster/records", {
        params: { entity, page },
      });
      setResult(response.data);
    } catch {
      setError(true);
      setResult(null);
    } finally {
      setBusy(false);
    }
  }, [entity, page]);

  useEffect(() => {
    if (open) {
      load();
    }
  }, [open, load]);

  const detail = result?.items.find((item) => item.id === selected);

  return (
    <div className="mt-4 rounded-lg border border-outline-variant p-3">
      <Button
        onClick={() => setOpen((value) => !value)}
        size="sm"
        type="button"
        variant="secondary"
      >
        {t(
          open
            ? "data_io.keymaster_archive_hide"
            : "data_io.keymaster_archive_view"
        )}
      </Button>
      {open && (
        <div className="mt-3">
          <p className="mb-3 text-on-surface-variant text-xs">
            {t("data_io.keymaster_archive_not_live")}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Select
              aria-label={t("data_io.keymaster_archive_type")}
              onChange={(event) => {
                setEntity(event.target.value as KeymasterEntity);
                setPage(1);
                setSelected(null);
                setResult(null);
              }}
              value={entity}
            >
              {ENTITIES.map((entry) => (
                <option key={entry.entity} value={entry.entity}>
                  {t(entry.label)}
                </option>
              ))}
            </Select>
            <Button
              disabled={busy}
              onClick={load}
              size="sm"
              type="button"
              variant="secondary"
            >
              {t("data_io.keymaster_archive_refresh")}
            </Button>
          </div>
          {error && (
            <p className="mt-2 text-error text-sm">
              {t("data_io.keymaster_archive_error")}
            </p>
          )}
          {busy && (
            <p className="mt-2 text-on-surface-variant text-sm">
              {t("data_io.keymaster_archive_loading")}
            </p>
          )}
          {!busy && result && (
            <>
              <p className="mt-3 text-on-surface text-sm">
                {t("data_io.keymaster_archive_count", {
                  count: result.total,
                  page: result.page,
                })}
              </p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-outline-variant border-b">
                      <th className="py-2 pe-3">
                        {t("data_io.keymaster_archive_reference")}
                      </th>
                      <th className="py-2 pe-3">
                        {t("data_io.keymaster_archive_description")}
                      </th>
                      <th className="py-2 pe-3">
                        {t("data_io.keymaster_archive_detail")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.map((item) => (
                      <tr
                        className="border-outline-variant border-b"
                        key={item.id}
                      >
                        <td className="py-2 pe-3">{item.sourceId}</td>
                        <td className="py-2 pe-3">{summary(item, entity)}</td>
                        <td className="py-2 pe-3">
                          <Button
                            onClick={() =>
                              setSelected((id) =>
                                id === item.id ? null : item.id
                              )
                            }
                            size="sm"
                            type="button"
                            variant="secondary"
                          >
                            {t("data_io.keymaster_archive_detail")}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  disabled={busy || page <= 1}
                  onClick={() => {
                    setPage((current) => current - 1);
                    setSelected(null);
                  }}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {t("data_io.keymaster_archive_previous")}
                </Button>
                <Button
                  disabled={busy || page * result.pageSize >= result.total}
                  onClick={() => {
                    setPage((current) => current + 1);
                    setSelected(null);
                  }}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {t("data_io.keymaster_archive_next")}
                </Button>
              </div>
              {detail && (
                <div className="mt-4 rounded-lg border border-outline-variant p-3">
                  <h4 className="font-semibold text-on-surface text-sm">
                    {t("data_io.keymaster_archive_detail")} — {detail.sourceId}
                  </h4>
                  <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                    {detail.headers.map((header, index) => {
                      const value = String(detail.values[index] ?? "");
                      if (!(header.trim() && value.trim())) {
                        return null;
                      }
                      return (
                        <div className="min-w-0" key={`${header}-${value}`}>
                          <dt className="text-on-surface-variant text-xs">
                            {header}
                          </dt>
                          <dd className="break-words text-on-surface text-sm">
                            {value}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
