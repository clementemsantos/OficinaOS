import { z } from "zod";

export const operationsQuery = z.object({
  q: z.string().trim().max(100).default(""),
  cursor: z.string().min(1).max(100).optional(),
});
export const retentionQuery = operationsQuery.extend({
  days: z.coerce.number().int().min(30).max(3650).default(180),
});
export const warrantyQuery = operationsQuery.extend({
  state: z
    .enum(["ACTIVE", "EXPIRING", "EXPIRED", "UNKNOWN"])
    .default("EXPIRING"),
});
