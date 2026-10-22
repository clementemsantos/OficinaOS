import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCan } from "@/hooks/use-can";
import api, { getErrorMessage } from "@/lib/api";
export function ClaimReasonEditor({
  claim,
  onSaved,
}: {
  claim: { id: string; status: string; returnReason: string };
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const canEdit = useCan({ returns: ["edit"] });
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(claim.returnReason);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api.patch(`/return-claims/${claim.id}`, {
        returnReason: value.trim(),
      });
      onSaved();
      setEditing(false);
    } catch (error) {
      toast.error(getErrorMessage(error, t("tasks.failed")));
    } finally {
      setBusy(false);
    }
  };
  if (!editing) {
    return (
      <div className="space-y-2">
        <p className="mt-1 whitespace-pre-wrap text-on-surface">
          {claim.returnReason}
        </p>
        {canEdit && claim.status === "OPEN" && (
          <Button
            onClick={() => {
              setValue(claim.returnReason);
              setEditing(true);
            }}
            variant="ghost"
          >
            {t("edit")}
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Textarea
        aria-label={t("returns_detail_customer_complaint")}
        disabled={busy}
        maxLength={2000}
        onChange={(event) => setValue(event.target.value)}
        value={value}
      />
      <Button disabled={!value.trim()} loading={busy} onClick={save}>
        {t("save")}
      </Button>
      <Button disabled={busy} onClick={() => setEditing(false)} variant="ghost">
        {t("cancel")}
      </Button>
    </div>
  );
}
