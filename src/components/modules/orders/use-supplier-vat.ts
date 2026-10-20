import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import api from "@/lib/api";
/** A supplier preference is a default for new lines, never a rewrite of history. */
export function useSupplierVat({
  supplierId,
  existingLine,
  initialRate,
  onRate,
}: {
  supplierId?: string | null;
  existingLine: boolean;
  initialRate: string;
  onRate: (rate: string) => void;
}) {
  const { t } = useTranslation();
  const failure = t("tasks.failed");
  const [withoutVat, setWithoutVat] = useState(
    existingLine && Number(initialRate) === 0
  );
  const initialSupplier = useRef(supplierId);
  const touched = useRef(false);
  const setRate = useRef(onRate);
  setRate.current = onRate;
  useEffect(() => {
    if (existingLine && supplierId === initialSupplier.current) {
      return;
    }
    touched.current = false;
    if (!supplierId) {
      setWithoutVat(false);
      return;
    }
    let active = true;
    api
      .get(`/suppliers/${supplierId}`)
      .then(({ data }) => {
        if (!(active && !touched.current)) {
          return;
        }
        const noVat = data.data?.chargesPurchaseVat === false;
        setWithoutVat(noVat);
        if (noVat) {
          setRate.current("0");
        }
      })
      .catch(() => {
        if (active) {
          toast.error(failure);
        }
      });
    return () => {
      active = false;
    };
  }, [supplierId, existingLine, failure]);
  return {
    withoutVat,
    changeWithoutVat: (value: boolean) => {
      touched.current = true;
      setWithoutVat(value);
      if (value) {
        setRate.current("0");
      }
    },
    rateChanged: () => {
      touched.current = true;
    },
  };
}
