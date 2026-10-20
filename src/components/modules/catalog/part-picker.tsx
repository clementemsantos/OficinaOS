import type { PartsCatalog } from "@shared/types";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import AddPartModal from "@/components/modules/parts/add-part-modal";
import { SearchPicker } from "@/components/ui/search-picker";
import { useCan } from "@/hooks/use-can";
import api from "@/lib/api";

export function PartPicker({
  value,
  onChange,
  initialPart,
}: {
  value: string;
  onChange: (id: string) => void;
  initialPart?: { id: string; name: string } | null;
}) {
  const { t } = useTranslation();
  const failure = t("tasks.failed");
  const canCreate = useCan({ parts: ["manageCatalog"] });
  const [rows, setRows] = useState<{ id: string; name: string }[]>(
    initialPart ? [initialPart] : []
  );
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("/parts", {
          params: { search: query || undefined, limit: 100 },
        });
        if (active) {
          setRows((old) => {
            const selected = old.find((row) => row.id === value);
            const next = data.parts as PartsCatalog[];
            return selected && !next.some((row) => row.id === value)
              ? [selected, ...next]
              : next;
          });
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
  }, [query, value, failure]);
  return (
    <>
      <SearchPicker
        label={t("rmas.part")}
        onChange={onChange}
        onCreate={canCreate ? () => setCreating(true) : undefined}
        onQuery={setQuery}
        options={rows}
        value={value}
      />
      {creating && (
        <AddPartModal
          onClose={() => setCreating(false)}
          onSubmit={async (input) => {
            const { data } = await api.post("/parts", input);
            setRows((old) => [data.part, ...old]);
            onChange(data.part.id);
            setCreating(false);
          }}
        />
      )}
    </>
  );
}
