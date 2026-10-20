import { z } from "zod";
export const integrationKind = z.enum(["WOOCOMMERCE", "EMAIL"]);
export const wooSettings = z.object({
  url: z
    .url()
    .max(500)
    .refine((value) => {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash
      );
    }),
  key: z.string().min(5).max(300),
  secret: z.string().min(5).max(300),
  since: z.iso.datetime(),
});
export const emailSettings = z.object({
  host: z
    .string()
    .trim()
    .min(3)
    .max(253)
    .regex(/^[a-zA-Z0-9.-]+$/),
  port: z.literal(993).default(993),
  user: z.string().min(1).max(300),
  password: z.string().min(1).max(1000),
  folder: z.string().min(1).max(200).default("INBOX"),
  since: z.iso.datetime(),
});
