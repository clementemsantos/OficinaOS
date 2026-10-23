import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import api from "@/lib/api";

interface Case {
  device: { model: string; brand: { name: string } };
  id: string;
  jobCode: string;
  partsUsed: {
    id: string;
    partName: string;
    quantity: number;
    rmaQuantity: number;
  }[];
  repairs: { id: string; repairName: string }[];
  reportedProblem: string;
  status: string;
}
export default function AtlasCasesPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState({ q: "", completed: "false" });
  const [cases, setCases] = useState<Case[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(
    async (next?: string) => {
      setBusy(true);
      try {
        const { data } = await api.get("/atlas/cases", {
          params: { ...filter, cursor: next },
        });
        setCases((old) => (next ? [...old, ...data.data] : data.data));
        setCursor(data.nextCursor);
      } catch {
        toast.error(t("tasks.failed"));
      } finally {
        setBusy(false);
      }
    },
    [filter, t]
  );
  useEffect(() => {
    load();
  }, [load]);
  return (
    <div className="space-y-5">
      <Link className="text-primary underline" to="/atlas">
        {t("atlas_cases.back")}
      </Link>
      <h1 className="font-bold text-2xl">{t("atlas_cases.title")}</h1>
      <p>{t("atlas_cases.hint")}</p>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          setFilter({
            q: String(values.get("q") ?? ""),
            completed: String(values.get("completed") ?? "false"),
          });
        }}
      >
        <label className="grow" htmlFor="atlas-case-search">
          {t("atlas_cases.search")}
          <Input id="atlas-case-search" name="q" />
        </label>
        <label htmlFor="atlas-case-completed">
          {t("orders_list.status")}
          <Select id="atlas-case-completed" name="completed">
            <option value="false">{t("orders_list.all")}</option>
            <option value="true">{t("atlas_cases.completed")}</option>
          </Select>
        </label>
        <Button disabled={busy} type="submit">
          {t("orders_list.filter")}
        </Button>
      </form>
      {!(cases.length || busy) && <p>{t("atlas_cases.empty")}</p>}
      <div className="space-y-4">
        {cases.map((item) => (
          <article
            className="space-y-3 rounded-xl bg-surface-container-low p-5"
            key={item.id}
          >
            <div className="flex flex-wrap justify-between gap-3">
              <h2 className="font-bold">
                {item.device.brand.name} {item.device.model}
              </h2>
              <span>
                {t(`status.${item.status}`, { defaultValue: item.status })}
              </span>
            </div>
            <p className="whitespace-pre-wrap">{item.reportedProblem}</p>
            <div>
              <h3 className="font-semibold">{t("atlas_cases.work")}</h3>
              {item.repairs.length ? (
                <ul>
                  {item.repairs.map((repair) => (
                    <li key={repair.id}>{repair.repairName}</li>
                  ))}
                </ul>
              ) : (
                <p>{t("atlas_cases.no_solution")}</p>
              )}
            </div>
            {!!item.partsUsed.length && (
              <div>
                <h3 className="font-semibold">{t("atlas_cases.parts")}</h3>
                <ul>
                  {item.partsUsed.map((part) => (
                    <li key={part.id}>
                      {part.partName} × {part.quantity}
                      {part.rmaQuantity > 0 &&
                        ` · ${t("rma_discount.line_note", { count: part.rmaQuantity })}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Link className="text-primary underline" to={`/jobs/${item.id}`}>
              {item.jobCode}
            </Link>
          </article>
        ))}
      </div>
      {cursor && (
        <Button disabled={busy} onClick={() => load(cursor)}>
          {t("tasks.more")}
        </Button>
      )}
      <Link className="text-primary underline" to="/atlas/colaborativo">
        {t("atlas_cases.review")}
      </Link>
    </div>
  );
}
