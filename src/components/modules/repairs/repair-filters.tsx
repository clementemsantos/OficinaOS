import type { RepairCategoryType } from "@shared/constants";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CategoryField } from "@/components/modules/catalog/category-field";

export type SortOption =
  | "recently_added"
  | "price_low_high"
  | "price_high_low"
  | "az";

interface RepairFiltersProps {
  activeCategory: RepairCategoryType | "ALL";
  activeSort: SortOption;
  customCategory: string;
  onCategoryChange: (category: RepairCategoryType | "ALL") => void;
  onCustomCategoryChange: (id: string) => void;
  onSearchChange: (query: string) => void;
  onSortChange: (sort: SortOption) => void;
  searchQuery: string;
}

const SORT_OPTIONS: { key: SortOption; labelKey: string }[] = [
  { key: "recently_added", labelKey: "recently_added" },
  { key: "price_low_high", labelKey: "price_low_high" },
  { key: "price_high_low", labelKey: "price_high_low" },
  { key: "az", labelKey: "sort_az" },
];

export default function RepairFilters({
  activeCategory,
  customCategory,
  onCustomCategoryChange,
  activeSort,
  onCategoryChange,
  onSearchChange,
  onSortChange,
  searchQuery,
}: RepairFiltersProps) {
  const { t } = useTranslation();
  const [localQuery, setLocalQuery] = useState(searchQuery);

  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [localQuery, onSearchChange]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-full">
        <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">
          search
        </span>
        <input
          className="w-full rounded-xl bg-surface-container-high py-2.5 ps-10 font-body text-on-surface text-sm placeholder:text-on-surface-variant/60 focus:bg-surface-container-lowest"
          onChange={(e) => setLocalQuery(e.target.value)}
          placeholder={t("search_repairs")}
          type="text"
          value={localQuery}
        />
        {localQuery && (
          <button
            aria-label={t("clear_filters")}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-on-surface-variant transition-colors hover:text-on-surface"
            onClick={() => {
              setLocalQuery("");
              onSearchChange("");
            }}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <CategoryField
            base={{
              value: activeCategory,
              onChange: (value) =>
                onCategoryChange(value as RepairCategoryType | "ALL"),
            }}
            filter
            onChange={onCustomCategoryChange}
            scope="REPAIR"
            value={customCategory}
          />
        </div>

        <span className="material-symbols-outlined text-base text-on-surface-variant">
          sort
        </span>
        <select
          aria-label={t("sort_by")}
          className="rounded-xl bg-surface-container-highest px-3 py-2 font-headline font-medium text-on-surface text-xs uppercase tracking-wide transition-colors focus:bg-surface-container"
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          value={activeSort}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {t(opt.labelKey)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
