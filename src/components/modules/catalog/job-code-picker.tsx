import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { SearchPicker } from "@/components/ui/search-picker";
import api from "@/lib/api";

export function JobCodePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  const { t } = useTranslation();
  const failure = t("tasks.failed");
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("/jobs", {
          params: { search: query || undefined, limit: 100 },
        });
        if (active) {
          setOptions(
            data.jobs.map((row: { jobCode: string }) => ({
              id: row.jobCode,
              name: row.jobCode,
            }))
          );
        }
      } catch {
        if (active) {
          toast.error(failure);
        }
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, failure]);
  const rows =
    value && !options.some((row) => row.id === value)
      ? [{ id: value, name: value }, ...options]
      : options;
  return (
    <SearchPicker
      label={t("rmas.job_code")}
      onChange={onChange}
      onQuery={setQuery}
      options={rows}
      value={value}
    />
  );
}
