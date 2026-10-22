import { z } from "zod";
export const rmaSource = z.object({
  kind: z.enum(["JOB", "SALE"]),
  reference: z.string().trim().min(1).max(100),
});
export const rmaDeduction = rmaSource.extend({
  lineId: z.string().min(1).max(100),
  expectedUpdatedAt: z.iso.datetime(),
});
export const rmaDeductionUndo = z.object({
  expectedUpdatedAt: z.iso.datetime(),
});
