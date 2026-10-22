import type { WorkflowType } from "@shared/constants/workflow";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SearchPicker } from "@/components/ui/search-picker";
import { Select } from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";
import api from "@/lib/api";
import { businessRecordPath } from "@/lib/business-links";
export function MessageLinks({
  messageId,
  links,
  onChanged,
}: {
  messageId: string;
  links: { id: string; entityType: WorkflowType; entityId: string }[];
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("JOB");
  const [query, setQuery] = useState("");
  const search = useDebounce(query, 250);
  const [target, setTarget] = useState("");
  const [choices, setChoices] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) {
      return;
    }
    let active = true;
    setChoices([]);
    api
      .get("/business/targets", {
        params: { entityType: type, search: search || undefined },
      })
      .then(({ data }) => {
        if (active) {
          setChoices(data.data);
        }
      })
      .catch(() => toast.error(t("tasks.failed")));
    return () => {
      active = false;
    };
  }, [type, t, open, search]);
  const add = async () => {
    setBusy(true);
    try {
      await api.post(`/business/messages/${messageId}/links`, {
        entityType: type,
        entityId: target,
      });
      onChanged();
    } catch {
      toast.error(t("tasks.failed"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <details
      className="my-3"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer font-semibold">
        {t("business.links")}
      </summary>
      <ul>
        {links.map((link) => (
          <li className="flex items-center gap-2" key={link.id}>
            <span>
              {businessRecordPath(link.entityType, link.entityId) ? (
                <Link
                  className="text-primary underline"
                  to={businessRecordPath(link.entityType, link.entityId) ?? ""}
                >
                  {t(`workflow.types.${link.entityType}`)}
                </Link>
              ) : (
                t(`workflow.types.${link.entityType}`)
              )}
            </span>
            <Button
              onClick={async () => {
                try {
                  await api.delete(
                    `/business/messages/${messageId}/links/${link.id}`
                  );
                  onChanged();
                } catch {
                  toast.error(t("tasks.failed"));
                }
              }}
              size="sm"
              variant="ghost"
            >
              {t("business.unlink")}
            </Button>
          </li>
        ))}
      </ul>
      <Select
        aria-label={t("business.link_type")}
        onChange={(event) => {
          setType(event.target.value);
          setTarget("");
          setQuery("");
        }}
        value={type}
      >
        {["JOB", "ORDER", "TICKET", "CUSTOMER", "SUPPLIER", "AGREEMENT"].map(
          (value) => (
            <option key={value} value={value}>
              {t(`workflow.types.${value}`)}
            </option>
          )
        )}
      </Select>
      <SearchPicker
        label={t("business.link_record")}
        onChange={(id) => setTarget(id)}
        onQuery={setQuery}
        options={choices}
        value={target}
      />

      <Button disabled={!target} loading={busy} onClick={add} size="sm">
        {t("business.link")}
      </Button>
    </details>
  );
}
