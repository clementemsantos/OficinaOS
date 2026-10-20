import type { PrismaClient } from "@generated/client";
import { cents, money, orderLinesTotals } from "@shared/business-finance";
import { AppError } from "@shared/errors/app-error.js";
import type { wooSettings } from "@shared/schemas/integrations";
import {
  type OrderLineInput,
  orderLinesFields,
} from "@shared/schemas/order-lines";
import { z } from "zod";
import { integrationJson } from "../lib/integration-network.js";

const TRAILING_SLASH = /\/$/;
const decimal = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/);
const item = z.object({
  name: z.string().max(200),
  quantity: z.number().int().min(1).max(10_000).default(1),
  total: decimal,
  total_tax: decimal,
  sku: z.string().optional(),
});
export const wooOrder = z.object({
  id: z.number().int().positive(),
  number: z.string(),
  currency: z.literal("EUR"),
  status: z.string(),
  total: decimal,
  billing: z.object({
    first_name: z.string(),
    last_name: z.string(),
    email: z.string(),
    phone: z.string(),
  }),
  line_items: z.array(item).max(45),
  shipping_lines: z
    .array(item.extend({ name: z.string().default("Portes") }))
    .max(3),
  fee_lines: z.array(item).max(2),
});
export function wooLines(order: z.infer<typeof wooOrder>): OrderLineInput[] {
  const lines: OrderLineInput[] = [];
  for (const line of [
    ...order.line_items,
    ...order.shipping_lines,
    ...order.fee_lines,
  ]) {
    const net = cents(line.total);
    const tax = cents(line.total_tax);
    if (!net && tax) {
      throw new AppError("VALIDATION_ERROR");
    }
    const gross = net + tax;
    const quantity = BigInt(line.quantity);
    const base = gross / quantity;
    const remainder = Number(gross % quantity);
    const rate = net ? money((tax * 10000n + net / 2n) / net) : "0";
    const common = {
      name: line.name || "WooCommerce",
      costKnown: false,
      costGross: "0",
      costVatRate: "0",
      saleVatRate: rate,
      recoverInputVat: true,
      reference: (line.sku ?? "").slice(0, 200),
      purchaseUrl: "",
    };
    if (line.quantity > remainder) {
      lines.push({
        ...common,
        quantity: line.quantity - remainder,
        quoteGross: money(base),
      });
    }
    if (remainder) {
      lines.push({
        ...common,
        quantity: remainder,
        quoteGross: money(base + 1n),
      });
    }
  }
  const parsed = orderLinesFields.safeParse(lines);
  if (
    !parsed.success ||
    cents(orderLinesTotals(lines).quoteGross) !== cents(order.total)
  ) {
    throw new AppError("VALIDATION_ERROR");
  }
  return parsed.data;
}
export async function syncWoo(
  prisma: PrismaClient,
  settings: z.infer<typeof wooSettings>,
  cursor: string | null
) {
  const checkpoint: { after: string; before: string; page: number } = cursor
    ? JSON.parse(cursor)
    : { after: settings.since, before: new Date().toISOString(), page: 1 };
  const base = new URL(settings.url).toString().replace(TRAILING_SLASH, "");
  const url = new URL(`${base}/wp-json/wc/v3/orders`);
  url.search = new URLSearchParams({
    per_page: "100",
    page: String(checkpoint.page),
    orderby: "modified",
    order: "asc",
    modified_after: checkpoint.after.slice(0, 19),
    modified_before: checkpoint.before.slice(0, 19),
    dates_are_gmt: "true",
  }).toString();
  const raw = z
    .array(z.unknown())
    .max(100)
    .parse(
      await integrationJson(
        url,
        `Basic ${Buffer.from(`${settings.key}:${settings.secret}`).toString("base64")}`
      )
    );
  let imported = 0;
  for (const value of raw) {
    const identity = z
      .object({ id: z.number().int(), status: z.string() })
      .parse(value);
    const sourceId = identity.id;
    if (
      ["cancelled", "failed", "trash", "refunded"].includes(identity.status)
    ) {
      continue;
    }
    const source = `WOO:${base}`;
    if (
      await prisma.integrationReceipt.findUnique({
        where: { source_externalId: { source, externalId: String(sourceId) } },
      })
    ) {
      continue;
    }
    const order = wooOrder.parse(value);
    const lines = wooLines(order);
    const totals = orderLinesTotals(lines);
    const customers = order.billing.email
      ? await prisma.customer.findMany({
          where: {
            email: { equals: order.billing.email, mode: "insensitive" },
          },
          select: { id: true },
          take: 2,
        })
      : [];
    await prisma.$transaction(async (tx) => {
      const local = await tx.purchaseOrder.create({
        data: {
          title: `WooCommerce #${order.number}`.slice(0, 200),
          kind: "PRODUCT",
          customerId: customers.length === 1 ? customers[0].id : null,
          reference: String(order.id),
          costGross: totals.costGross,
          quoteGross: totals.quoteGross,
          notes: [
            `WooCommerce: ${base}`,
            `Estado na importação: ${order.status}`,
            `${order.billing.first_name} ${order.billing.last_name}`,
            order.billing.email,
            order.billing.phone,
            "IVA de venda estimado a partir do pedido. Confirmar na fatura original.",
          ].join("\n"),
          lines: {
            create: lines.map((line, position) => ({
              ...line,
              id: undefined,
              position,
            })),
          },
        },
      });
      await tx.integrationReceipt.create({
        data: { source, externalId: String(order.id), recordId: local.id },
      });
    });
    imported++;
  }
  return {
    imported,
    cursor: JSON.stringify(
      raw.length === 100
        ? { ...checkpoint, page: checkpoint.page + 1 }
        : {
            after: new Date(
              new Date(checkpoint.before).getTime() - 1000
            ).toISOString(),
            before: new Date().toISOString(),
            page: 1,
          }
    ),
  };
}
