import { z } from "zod";
import { cents, orderLinesTotals } from "../business-finance";
import { amount, orderFields, rate } from "./business";

const optionalId = z.string().min(1).max(100).nullable().optional();
export const orderLineFields = z
  .object({
    id: z.string().min(1).max(100).optional(),
    name: z.string().trim().min(1).max(200),
    quantity: z.number().int().min(1).max(10_000),
    partId: optionalId,
    supplierId: optionalId,
    reference: z.string().max(200).default(""),
    purchaseUrl: orderFields.shape.purchaseUrl,
    costGross: amount,
    quoteGross: amount,
    costVatRate: rate,
    saleVatRate: rate,
    recoverInputVat: z.boolean(),
  })
  .strict();
export const orderLinesFields = z
  .array(orderLineFields)
  .min(1)
  .max(100)
  .superRefine((lines, ctx) => {
    const ids = lines.flatMap((line) => (line.id ? [line.id] : []));
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", message: "Duplicate line ID" });
    }
    if (!lines.every((line) => orderLineFields.safeParse(line).success)) {
      return;
    }
    const totals = orderLinesTotals(lines);
    const max = 99999999999999n;
    if (cents(totals.costGross) > max || cents(totals.quoteGross) > max) {
      ctx.addIssue({
        code: "custom",
        message: "Order amount exceeds the supported limit",
      });
    }
  });
export const createOrderFields = orderFields
  .extend({ lines: orderLinesFields.optional() })
  .strict();
export const updateOrderFields = orderFields
  .partial()
  .extend({
    lines: orderLinesFields.optional(),
    expectedUpdatedAt: z.iso.datetime().optional(),
  })
  .strict()
  .refine((value) => !value.lines || Boolean(value.expectedUpdatedAt), {
    path: ["expectedUpdatedAt"],
    message: "Order version required",
  });
export type OrderLineInput = z.infer<typeof orderLineFields>;
