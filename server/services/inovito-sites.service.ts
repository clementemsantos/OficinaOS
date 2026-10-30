import { z } from "zod";
import { integrationJson } from "../lib/integration-network.js";

/**
 * Approved origins come from trusted server configuration, NEVER from an HTTP
 * query parameter. No WooCommerce credentials are needed for the public Store
 * API; only products actually published on the site can be returned.
 */
const DEFAULT_SITE = "https://inove.pt";
const MAX_SITES = 8;
const SITE_ORIGIN_PATTERN = /^[a-z0-9.-]{1,253}$/;
const SITE_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const IPV4_PATTERN = /^\d+\.\d+\.\d+\.\d+$/;
const MAX_NAME = 160;

export interface SiteConfig {
  id: string;
  name: string;
  origin: string;
}

export interface SiteProduct {
  id: number;
  name: string;
  permalink: string;
  price: string | null;
}

export interface SitePreview extends SiteConfig {
  online: boolean;
  products: SiteProduct[];
}

/** No freeform IP, credentials, paths, query strings or non-HTTPS URLs. */
export function parseSiteOrigin(raw: string): SiteConfig | null {
  try {
    const url = new URL(raw.trim());
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      !(host && SITE_ORIGIN_PATTERN.test(host)) ||
      host === "localhost" ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      host.includes("..") ||
      url.port ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    // Prevent IP literals and names with invalid label boundaries; the
    // integrationJson transport also rejects private/reserved resolved IPs.
    const validLabels = host
      .split(".")
      .every(
        (label) =>
          label.length > 0 &&
          label.length <= 63 &&
          SITE_LABEL_PATTERN.test(label)
      );
    if (!validLabels || host.split(".").length < 2) {
      return null;
    }
    if (IPV4_PATTERN.test(host)) {
      return null;
    }
    return { id: host, name: host, origin: url.origin };
  } catch {
    return null;
  }
}

/** Future sites can be added through a server environment setting, no code deploy. */
export function configuredSites(
  setting = process.env.INOVITO_SITE_ORIGINS
): SiteConfig[] {
  const values = (setting || DEFAULT_SITE).split(",");
  const sites: SiteConfig[] = [];
  for (const raw of values) {
    if (sites.length >= MAX_SITES) {
      break;
    }
    const config = parseSiteOrigin(raw);
    if (config && !sites.some((item) => item.id === config.id)) {
      sites.push(config);
    }
  }
  return sites;
}

const storeProduct = z.object({
  id: z.number().int().positive(),
  name: z.string().max(400),
  permalink: z.string().url().max(1200),
  prices: z
    .object({
      price: z.string().regex(/^\d{1,12}$/),
      currency_code: z.string().regex(/^[A-Z]{3}$/),
      currency_minor_unit: z.number().int().min(0).max(4),
    })
    .optional(),
});

export function normalizeSiteProducts(
  input: unknown,
  origin: string
): SiteProduct[] {
  const decoded = z.array(z.unknown()).max(8).safeParse(input);
  if (!decoded.success) {
    return [];
  }
  return decoded.data.flatMap((raw) => {
    const data = storeProduct.safeParse(raw);
    if (!data.success) {
      return [];
    }
    try {
      const link = new URL(data.data.permalink);
      if (link.origin !== origin || link.protocol !== "https:") {
        return [];
      }
      const prices = data.data.prices;
      let price: string | null = null;
      if (prices) {
        const integer = Number(prices.price) / 10 ** prices.currency_minor_unit;
        if (Number.isFinite(integer)) {
          price = new Intl.NumberFormat("pt-PT", {
            style: "currency",
            currency: prices.currency_code,
          }).format(integer);
        }
      }
      return [
        {
          id: data.data.id,
          name: data.data.name.trim().slice(0, MAX_NAME),
          price,
          permalink: link.href,
        },
      ];
    } catch {
      return [];
    }
  });
}

async function readSitePreview(site: SiteConfig): Promise<SitePreview> {
  try {
    const url = new URL("/wp-json/wc/store/v1/products", site.origin);
    url.searchParams.set("per_page", "5");
    url.searchParams.set("orderby", "date");
    url.searchParams.set("order", "desc");
    const raw = await integrationJson(url, "");
    return {
      ...site,
      online: true,
      products: normalizeSiteProducts(raw, site.origin),
    };
  } catch {
    // Do not leak internal DNS or network details into a mobile API response.
    return { ...site, online: false, products: [] };
  }
}

export function readConfiguredSites(): Promise<SitePreview[]> {
  return Promise.all(configuredSites().map(readSitePreview));
}
