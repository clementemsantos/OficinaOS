import { z } from "zod";
import { amount } from "./business";

const optionalDate = z.iso.date().nullable().default(null);
export const campaignBase = z
  .object({
    name: z.string().trim().min(1).max(160),
    channel: z.enum([
      "GOOGLE_ADS",
      "META_ADS",
      "EMAIL",
      "WHATSAPP",
      "SMS",
      "OTHER",
    ]),
    status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ENDED"]),
    objective: z.string().trim().max(4000).default(""),
    budget: amount,
    spend: amount,
    startDate: optionalDate,
    endDate: optionalDate,
    landingUrl: z
      .union([z.literal(""), z.url({ protocol: /^https?$/ })])
      .default(""),
  })
  .strict();
export const campaignFields = campaignBase.refine(
  (value) =>
    !(value.startDate && value.endDate) || value.startDate <= value.endDate,
  { path: ["endDate"], message: "End date must follow start date" }
);
export const leadFields = z
  .object({
    title: z.string().trim().min(1).max(200),
    customerId: z.string().min(1).max(100).nullable().default(null),
    campaignId: z.string().min(1).max(100).nullable().default(null),
    stage: z.enum(["NEW", "QUALIFIED", "QUOTE_SENT", "WON", "LOST"]),
    value: amount,
    followUpDate: optionalDate,
    notes: z.string().trim().max(8000).default(""),
  })
  .strict();
export const marketingVersion = z.object({
  expectedUpdatedAt: z.iso.datetime(),
});
export const marketingQuery = z.object({
  q: z.string().trim().max(100).optional(),
  cursor: z.string().max(100).optional(),
});

export const campaignUpdate = campaignBase
  .extend(marketingVersion.shape)
  .refine(
    (value) =>
      !(value.startDate && value.endDate) || value.startDate <= value.endDate,
    { path: ["endDate"], message: "End date must follow start date" }
  );
