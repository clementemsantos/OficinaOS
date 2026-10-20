import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useCan } from "@/hooks/use-can";
import api from "@/lib/api";
import { CategoryField } from "./category-field";
export function RecordCategory({
  scope,
  id,
  initialId,
}: {
  scope: "CUSTOMER" | "SUPPLIER";
  id: string;
  initialId?: string | null;
}) {
  const { t } = useTranslation();
  const customer = useCan({ customers: ["edit"] });
  const supplier = useCan({ parts: ["manageCatalog"] });
  const [value, setValue] = useState(initialId ?? "");
  const [busy, setBusy] = useState(false);
  const save = async (next: string) => {
    setBusy(true);
    try {
      const resource = scope === "CUSTOMER" ? "customers" : "suppliers";
      await api.patch(`/${resource}/${id}`, { customCategoryId: next || null });
      setValue(next);
    } catch {
      toast.error(t("tasks.failed"));
    } finally {
      setBusy(false);
    }
  };
  const edit = scope === "CUSTOMER" ? customer : supplier;
  if (!edit) {
    return null;
  }
  return (
    <CategoryField
      disabled={busy}
      onChange={save}
      scope={scope}
      value={value}
    />
  );
}
