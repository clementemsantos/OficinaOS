import { PartCategory, RepairCategory } from "@shared/constants";
import type { JobPart, JobRepair } from "@shared/types";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CategoryField } from "@/components/modules/catalog/category-field";
import { SupplierPicker } from "@/components/modules/catalog/supplier-picker";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useCan } from "@/hooks/use-can";
import api, { getErrorMessage } from "@/lib/api";
export function JobLineEditor({
  jobId,
  line,
  kind,
  onClose,
  onChanged,
}: {
  jobId: string;
  line: JobPart | JobRepair;
  kind: "PART" | "REPAIR";
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { t } = useTranslation();
  const cost = useCan({ parts: ["viewCost", "setCost"] });
  const isPart = kind === "PART";
  const part = line as JobPart;
  const repair = line as JobRepair;
  const [name, setName] = useState(isPart ? part.partName : repair.repairName);
  const [price, setPrice] = useState(
    String(isPart ? part.unitPrice : repair.price)
  );
  const [quantity, setQuantity] = useState(String(isPart ? part.quantity : 1));
  const [supplierId, setSupplierId] = useState(
    isPart ? (part.supplierId ?? "") : ""
  );
  const [supplier, setSupplier] = useState(isPart ? (part.supplier ?? "") : "");
  const [category, setCategory] = useState<string>(line.category);
  const [custom, setCustom] = useState(line.customCategoryId ?? "");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const data = isPart
        ? {
            partName: name,
            category,
            quantity: Number(quantity),
            supplierId: supplierId || null,
            supplier,
            customCategoryId: custom || null,
            ...(cost ? { unitPrice: Number(price) } : {}),
          }
        : {
            repairName: name,
            category,
            price: Number(price),
            customCategoryId: custom || null,
          };
      await api.patch(
        `/jobs/${jobId}/${isPart ? "parts" : "repairs"}/${line.id}`,
        data
      );
      onChanged?.();
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, t("tasks.failed")));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog onClose={onClose} open title={t("catalog.edit_line")}>
      <div className="space-y-3">
        <Field label={t("catalog.name")}>
          <Input
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </Field>
        <Field label={t("catalog.base_category")}>
          <Select
            onChange={(event) => setCategory(event.target.value)}
            value={category}
          >
            {Object.values(isPart ? PartCategory : RepairCategory).map(
              (value) => (
                <option key={value} value={value}>
                  {t(
                    `${isPart ? "part_category" : "repair_category"}.${value}`
                  )}
                </option>
              )
            )}
          </Select>
        </Field>
        <CategoryField onChange={setCustom} scope={kind} value={custom} />
        {(!isPart || cost) && (
          <Field label={t("catalog.price")}>
            <Input
              min="0"
              onChange={(event) => setPrice(event.target.value)}
              step="0.01"
              type="number"
              value={price}
            />
          </Field>
        )}
        {isPart && (
          <>
            <Field label={t("catalog.quantity")}>
              <Input
                max="10000"
                min="1"
                onChange={(event) => setQuantity(event.target.value)}
                step="1"
                type="number"
                value={quantity}
              />
            </Field>
            <SupplierPicker
              onChange={(id, value) => {
                setSupplierId(id);
                setSupplier(value);
              }}
              value={supplierId}
            />
          </>
        )}
        <Button
          disabled={!(name.trim() && quantity) || ((!isPart || cost) && !price)}
          loading={busy}
          onClick={save}
        >
          {t("save")}
        </Button>
        <Button onClick={onClose} variant="ghost">
          {t("cancel")}
        </Button>
      </div>
    </Dialog>
  );
}
