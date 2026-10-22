import { z } from "zod";
export const categoryScopes = [
  "PART",
  "REPAIR",
  "CUSTOMER",
  "SUPPLIER",
  "ORDER",
  "TICKET",
  "AGREEMENT",
] as const;
export type CategoryScope = (typeof categoryScopes)[number];
export const categoryFields = z.object({
  name: z.string().trim().min(1).max(120),
  parentId: z.string().min(1).nullable().default(null),
  isActive: z.boolean().default(true),
});
