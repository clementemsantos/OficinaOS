import { z } from "zod";
import { integrationJson } from "../lib/integration-network.js";
import {
  configuredSites,
  parseSiteOrigin,
} from "./inovito-sites.service.js";

/** Explicit opt-in so merely deploying this code never activates private access. */
export function wooPrivateEnabled(): boolean {
  return process.env.INOVITO_WOO_PRIVATE_ENABLED === "true" &&
    process.env.OFICINAOS_SANDBOX !== "true" &&
    process.env.DEMO_MODE !== "true";
}

export const wooPrivateConnectInput = z.object({
  origin: z.string().max(253),
  key: z.string().trim().min(5).max(300),
  secret: z.string().trim().min(5).max(300),
});

export interface WooPrivateCredentials {
  key: string;
  secret: string;
}

export function permittedWooOrigin(origin: string): string | null {
  const config = parseSiteOrigin(origin);
  if (!config) {
    return null;
  }
  const approved = configuredSites().some((item) => item.origin === config.origin);
  return approved ? config.origin : null;
}

const rawWooOrder = z.object({
  id: z.number().int().positive(),
  number: z.string().max(100),
  status: z.string().max(80),
  total: z.string().regex(/^\d{1,12}(?:\.\d{1,2})?$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  date_modified_gmt: z.string().max(40).optional(),
});

export interface WooOrderPreview {
  id: number;
  number: string;
  status: string;
  total: string;
  dateModified: string | null;
}

/** Only non-personal fields. No billing, email, address, phone, or line items. */
export function parseWooOrderPreviews(raw: unknown): WooOrderPreview[] {
  const collection = z.array(z.unknown()).max(5).safeParse(raw);
  if (!collection.success) {
    return [];
  }
  return collection.data.flatMap((value) => {
    const parsed = rawWooOrder.safeParse(value);
    if (!parsed.success) {
      return [];
    }
    const order = parsed.data;
    const totalNumber = Number(order.total);
    if (!Number.isFinite(totalNumber)) {
      return [];
    }
    return [{
      id: order.id,
      number: order.number,
      status: order.status,
      total: new Intl.NumberFormat("pt-PT", {
        style: "currency",
        currency: order.currency,
      }).format(totalNumber),
      dateModified: order.date_modified_gmt ?? null,
    }];
  });
}

export async function verifyWooReadAccess(
  origin: string,
  credentials: WooPrivateCredentials
): Promise<WooOrderPreview[]> {
  const url = new URL("/wp-json/wc/v3/orders", origin);
  url.searchParams.set("per_page", "5");
  url.searchParams.set("orderby", "modified");
  url.searchParams.set("order", "desc");
  url.searchParams.set("_fields", "id,number,status,total,currency,date_modified_gmt");
  const secret = Buffer.from(
    `${credentials.key}:${credentials.secret}`
  ).toString("base64");
  const raw = await integrationJson(url, `Basic ${secret}`);
  return parseWooOrderPreviews(raw);
}
