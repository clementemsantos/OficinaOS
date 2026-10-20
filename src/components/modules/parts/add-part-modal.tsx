import type { PartCategoryType } from "@shared/constants";
import type { PartsCatalog } from "@shared/types";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CategoryField } from "@/components/modules/catalog/category-field";
import { SupplierPicker } from "@/components/modules/catalog/supplier-picker";
import { Button } from "@/components/ui/button";
import ConfirmDiscardDialog from "@/components/ui/confirm-discard-dialog";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useModalEffects } from "@/hooks/use-modal-effects";

interface AddPartFormData {
  category: PartCategoryType | "";
  customCategoryId: string;
  defaultPrice: string;
  isActive: boolean;
  listedOnline: boolean;
  name: string;
  reorderLevel: string;
  /** Opening stock — create only; later changes go through stock movements. */
  stockQuantity: string;
  supplier: string;
  /** Linked Supplier record — "" means none. */
  supplierId: string;
}

export type AddPartSubmitData = Omit<
  AddPartFormData,
  | "customCategoryId"
  | "defaultPrice"
  | "reorderLevel"
  | "stockQuantity"
  | "supplierId"
> & {
  customCategoryId: string | null;
  defaultPrice: number;
  reorderLevel: number;
  stockQuantity?: number;
  /** null clears the supplier link on update. */
  supplierId: string | null;
};

interface AddPartModalProps {
  editingPart?: PartsCatalog | null;
  onClose: () => void;
  onSubmit: (data: AddPartSubmitData) => Promise<void> | void;
}

const PRICE_REGEX = /^\d*\.?\d{0,2}$/;
const INT_REGEX = /^\d{0,6}$/;

const INITIAL_FORM: AddPartFormData = {
  customCategoryId: "",
  name: "",
  category: "",
  defaultPrice: "",
  supplier: "",
  supplierId: "",
  isActive: true,
  listedOnline: false,
  reorderLevel: "",
  stockQuantity: "",
};

function isDirty(
  form: AddPartFormData,
  editingPart: PartsCatalog | null | undefined
): boolean {
  if (editingPart) {
    return (
      form.customCategoryId !== (editingPart.customCategoryId ?? "") ||
      form.name !== editingPart.name ||
      form.category !== editingPart.category ||
      Number.parseFloat(form.defaultPrice) !==
        Number(editingPart.defaultPrice) ||
      form.supplier !== (editingPart.supplier ?? "") ||
      form.supplierId !== (editingPart.supplierId ?? "") ||
      form.isActive !== editingPart.isActive ||
      form.listedOnline !== editingPart.listedOnline ||
      form.reorderLevel !== String(editingPart.reorderLevel ?? 0)
    );
  }
  return (
    form.customCategoryId !== INITIAL_FORM.customCategoryId ||
    form.name !== INITIAL_FORM.name ||
    form.category !== INITIAL_FORM.category ||
    form.defaultPrice !== INITIAL_FORM.defaultPrice ||
    form.supplier !== INITIAL_FORM.supplier ||
    form.supplierId !== INITIAL_FORM.supplierId ||
    form.isActive !== INITIAL_FORM.isActive ||
    form.listedOnline !== INITIAL_FORM.listedOnline ||
    form.reorderLevel !== INITIAL_FORM.reorderLevel ||
    form.stockQuantity !== INITIAL_FORM.stockQuantity
  );
}

export default function AddPartModal({
  editingPart,
  onClose,
  onSubmit,
}: AddPartModalProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);

  const isEditing = !!editingPart;

  const [form, setForm] = useState<AddPartFormData>(() => {
    if (editingPart) {
      return {
        customCategoryId: editingPart.customCategoryId ?? "",
        name: editingPart.name,
        category: editingPart.category as PartCategoryType,
        defaultPrice: String(editingPart.defaultPrice),
        supplier: editingPart.supplier ?? "",
        supplierId: editingPart.supplierId ?? "",
        isActive: editingPart.isActive,
        listedOnline: editingPart.listedOnline,
        reorderLevel: String(editingPart.reorderLevel ?? 0),
        stockQuantity: String(editingPart.stockQuantity ?? 0),
      };
    }
    return { ...INITIAL_FORM };
  });
  const [errors, setErrors] = useState<
    Partial<Record<"name" | "category" | "defaultPrice", string>>
  >({});
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const update = useCallback(
    <K extends keyof AddPartFormData>(key: K, value: AddPartFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      if (key === "name" && value.toString().trim()) {
        setErrors((prev) => ({ ...prev, name: undefined }));
      }
      if (key === "category" && value) {
        setErrors((prev) => ({ ...prev, category: undefined }));
      }
      if (
        key === "defaultPrice" &&
        value &&
        Number.parseFloat(String(value)) > 0
      ) {
        setErrors((prev) => ({ ...prev, defaultPrice: undefined }));
      }
    },
    []
  );

  const handleRequestClose = useCallback(() => {
    if (isDirty(form, editingPart ?? null)) {
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  }, [form, editingPart, onClose]);

  // Escape goes through the dirty-check confirm, not straight to onClose.
  useModalEffects(true, handleRequestClose, dialogRef);

  async function handleSubmit(e: React.FormEvent) {
    if (submitting) {
      return;
    }
    e.preventDefault();
    const newErrors: Partial<
      Record<"name" | "category" | "defaultPrice", string>
    > = {};
    if (!form.name.trim()) {
      newErrors.name = t("add_part_modal.error_name_required");
    }
    if (!form.category) {
      newErrors.category = t("add_part_modal.error_category_required");
    }
    const priceVal = Number.parseFloat(form.defaultPrice);
    if (!form.defaultPrice || Number.isNaN(priceVal) || priceVal < 0) {
      newErrors.defaultPrice = t("add_part_modal.error_price_invalid");
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        customCategoryId: form.customCategoryId || null,
        name: form.name,
        category: form.category as PartCategoryType,
        defaultPrice: priceVal,
        supplier: form.supplier,
        supplierId: form.supplierId || null,
        isActive: form.isActive,
        listedOnline: form.listedOnline,
        reorderLevel: Number.parseInt(form.reorderLevel, 10) || 0,
        stockQuantity: isEditing
          ? undefined
          : Number.parseInt(form.stockQuantity, 10) || 0,
      });
    } catch {
      toast.error(t("tasks.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        aria-hidden="true"
        className="absolute inset-0 bg-overlay backdrop-blur-[20px]"
        onClick={handleRequestClose}
        tabIndex={-1}
        type="button"
      />
      <ConfirmDiscardDialog
        onDiscard={onClose}
        onKeepEditing={() => setShowConfirmClose(false)}
        open={showConfirmClose}
      />
      <div
        aria-labelledby="add-part-modal-title"
        aria-modal="true"
        className="relative z-10 mx-4 max-h-[90dvh] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-surface-container-lowest shadow-2xl"
        id="add-part-modal"
        ref={dialogRef}
        role="dialog"
      >
        <form onSubmit={handleSubmit}>
          <div className="bg-surface-container-low px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h2
                  className="font-bold font-headline text-on-surface text-xl tracking-tight"
                  id="add-part-modal-title"
                >
                  {isEditing ? t("edit_part") : t("add_part_modal.title")}
                </h2>
                <p className="mt-0.5 text-on-surface-variant text-sm">
                  {t("add_part_modal.subtitle")}
                </p>
              </div>
              <button
                aria-label={t("close")}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                onClick={handleRequestClose}
                type="button"
              >
                <Icon name="close" size="sm" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-5 px-6 py-6">
            <div>
              <Label className="mb-2 block" htmlFor="part-name">
                {t("add_part_modal.part_name")}
              </Label>
              <Input
                aria-describedby={errors.name ? "error-part-name" : undefined}
                aria-invalid={!!errors.name || undefined}
                autoComplete="off"
                id="part-name"
                onChange={(e) => update("name", e.target.value)}
                placeholder={t("add_part_modal.part_name_placeholder")}
                required
                value={form.name}
              />
              {errors.name && (
                <p
                  className="mt-1.5 rounded-lg bg-error-container px-3 py-1.5 font-bold text-on-error-container text-xs"
                  id="error-part-name"
                  role="alert"
                >
                  {errors.name}
                </p>
              )}
            </div>

            <CategoryField
              base={{
                value: form.category,
                onChange: (value) =>
                  update("category", value as PartCategoryType),
              }}
              onChange={(id) => update("customCategoryId", id)}
              scope="PART"
              value={form.customCategoryId}
            />
            {errors.category && (
              <p className="text-error text-sm" role="alert">
                {errors.category}
              </p>
            )}

            <div>
              <Label className="mb-2 block" htmlFor="part-price">
                {t("add_part_modal.default_price")}
              </Label>
              <div className="relative">
                <span className="absolute start-4 top-1/2 -translate-y-1/2 font-mono text-on-surface-variant text-sm">
                  {t("currency_eur")}
                </span>
                <Input
                  aria-describedby={
                    errors.defaultPrice ? "error-part-price" : undefined
                  }
                  aria-invalid={!!errors.defaultPrice || undefined}
                  autoComplete="off"
                  className="ps-10 font-mono"
                  id="part-price"
                  min="0"
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || PRICE_REGEX.test(val)) {
                      update("defaultPrice", val);
                    }
                  }}
                  placeholder="0"
                  required
                  step="0.01"
                  type="number"
                  value={form.defaultPrice}
                />
                {errors.defaultPrice && (
                  <p
                    className="mt-1.5 rounded-lg bg-error-container px-3 py-1.5 font-bold text-on-error-container text-xs"
                    id="error-part-price"
                    role="alert"
                  >
                    {errors.defaultPrice}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label className="mb-2 block" htmlFor="part-supplier">
                {t("add_part_modal.supplier")}{" "}
                <span className="font-normal text-on-surface-variant text-xs normal-case tracking-normal">
                  ({t("add_part_modal.optional")})
                </span>
              </Label>
              <Input
                autoComplete="off"
                id="part-supplier"
                onChange={(e) => update("supplier", e.target.value)}
                placeholder={t("add_part_modal.supplier_placeholder")}
                value={form.supplier}
              />
            </div>

            <div>
              <Label className="mb-2 block" htmlFor="part-supplier-link">
                {t("add_part_modal.supplier_link")}{" "}
                <span className="font-normal text-on-surface-variant text-xs normal-case tracking-normal">
                  ({t("add_part_modal.optional")})
                </span>
              </Label>
              <div className="relative">
                <SupplierPicker
                  id="part-supplier-link"
                  onChange={(id, name) => {
                    update("supplierId", id);
                    update("supplier", name);
                  }}
                  value={form.supplierId}
                />
                <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2">
                  <Icon name="expand_more" size="sm" />
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {!isEditing && (
                <div>
                  <Label className="mb-2 block" htmlFor="part-stock">
                    {t("add_part_modal.initial_stock")}
                  </Label>
                  <Input
                    autoComplete="off"
                    className="font-mono"
                    id="part-stock"
                    inputMode="numeric"
                    onChange={(e) => {
                      if (INT_REGEX.test(e.target.value)) {
                        update("stockQuantity", e.target.value);
                      }
                    }}
                    placeholder="0"
                    value={form.stockQuantity}
                  />
                </div>
              )}
              <div>
                <Label className="mb-2 block" htmlFor="part-reorder">
                  {t("add_part_modal.reorder_level")}
                </Label>
                <Input
                  aria-describedby="part-reorder-hint"
                  autoComplete="off"
                  className="font-mono"
                  id="part-reorder"
                  inputMode="numeric"
                  onChange={(e) => {
                    if (INT_REGEX.test(e.target.value)) {
                      update("reorderLevel", e.target.value);
                    }
                  }}
                  placeholder="0"
                  value={form.reorderLevel}
                />
                <p
                  className="mt-1 text-on-surface-variant text-xs"
                  id="part-reorder-hint"
                >
                  {t("add_part_modal.reorder_level_hint")}
                </p>
              </div>
            </div>

            <fieldset
              aria-labelledby="active-status-label"
              className="flex items-center justify-between rounded-xl border-none bg-surface-container-low px-4 py-3"
            >
              <div>
                <p
                  className="font-bold text-on-surface text-sm"
                  id="active-status-label"
                >
                  {t("add_part_modal.active_status")}
                </p>
                <p className="text-on-surface-variant text-xs">
                  {t("add_part_modal.active_status_desc")}
                </p>
              </div>
              <Switch
                ariaLabelledBy="active-status-label"
                checked={form.isActive}
                onChange={(val) => update("isActive", val)}
              />
            </fieldset>

            <fieldset
              aria-labelledby="listed-online-label"
              className="flex items-center justify-between rounded-xl border-none bg-surface-container-low px-4 py-3"
            >
              <div>
                <p
                  className="font-bold text-on-surface text-sm"
                  id="listed-online-label"
                >
                  {t("add_part_modal.listed_online")}
                </p>
                <p className="text-on-surface-variant text-xs">
                  {t("add_part_modal.listed_online_desc")}
                </p>
              </div>
              <Switch
                ariaLabelledBy="listed-online-label"
                checked={form.listedOnline}
                onChange={(val) => update("listedOnline", val)}
              />
            </fieldset>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4">
            <Button
              onClick={handleRequestClose}
              type="button"
              variant="secondary"
            >
              {t("add_part_modal.cancel")}
            </Button>
            <Button
              icon={isEditing ? "check" : "add"}
              loading={submitting}
              type="submit"
            >
              {isEditing ? t("save") : t("add_part_modal.add_part")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
