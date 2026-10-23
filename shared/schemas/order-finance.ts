import { z } from "zod";
import { addPaymentSchema } from "./payment.schema";
export const orderPaymentFields = addPaymentSchema
  .extend({
    requestKey: z.uuid(),
    expectedUpdatedAt: z.iso.datetime(),
  })
  .refine(
    (value) =>
      Number.isInteger(Math.round(value.amount * 100)) &&
      Math.abs(value.amount * 100 - Math.round(value.amount * 100)) < 0.000_001,
    { path: ["amount"], message: "Use at most two decimal places" }
  );
export const orderQuoteFields = z.object({
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED"]),
  expectedUpdatedAt: z.iso.datetime(),
});
export const voidOrderPaymentFields = z.object({
  reason: z.string().trim().min(3).max(500),
});
