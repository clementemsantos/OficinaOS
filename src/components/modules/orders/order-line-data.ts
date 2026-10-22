import type { OrderLineInput } from "@shared/schemas/order-lines";
import type { OrderLineView } from "@shared/types/purchase-order";
export function orderLineInput(line: OrderLineView): OrderLineInput {
  return {
    id: line.id,
    name: line.name,
    quantity: line.quantity,
    partId: line.partId ?? null,
    supplierId: line.supplierId ?? null,
    reference: line.reference ?? "",
    purchaseUrl: line.purchaseUrl ?? "",
    costKnown: line.costKnown ?? true,
    costGross: line.costGross ?? "0",
    quoteGross: line.quoteGross ?? "0",
    costVatRate: line.costVatRate ?? "0",
    saleVatRate: line.saleVatRate ?? "0",
    recoverInputVat: line.recoverInputVat ?? true,
  };
}
