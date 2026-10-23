import type { OrderLineInput } from "../schemas/order-lines";
export interface RecordLabel {
  id: string;
  name: string;
}
type LineFinancialFields =
  | "costKnown"
  | "costGross"
  | "quoteGross"
  | "costVatRate"
  | "saleVatRate"
  | "recoverInputVat";
export type OrderLineView = Omit<
  OrderLineInput,
  LineFinancialFields | "reference" | "purchaseUrl"
> &
  Partial<Pick<OrderLineInput, LineFinancialFields>> & {
    reference?: string | null;
    purchaseUrl?: string | null;
    part?: RecordLabel | null;
    supplier?: RecordLabel | null;
  };
export interface PurchaseOrderView {
  costGross?: string;
  costsComplete?: boolean;
  createdAt: string;
  customCategoryId: string | null;
  customer: RecordLabel | null;
  customerId: string | null;
  id: string;
  job?: { id: string; jobCode: string } | null;
  jobId: string | null;
  kind: string;
  lines: OrderLineView[];
  margin?: {
    profitAfterVat: string;
    revenueNet: string;
    costNet: string;
    vatBalance: string;
    marginPercent: number | null;
  };
  notes: string | null;
  number?: number;
  partId: string | null;
  purchaseUrl: string | null;
  quoteGross?: string;
  reference: string | null;
  supplier: RecordLabel | null;
  supplierId: string | null;
  title: string;
  updatedAt: string;
  workflowState?: RecordLabel | null;
}
