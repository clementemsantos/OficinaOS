import type { Prisma, PrismaClient } from "@generated/client";
import { orderLinesTotals } from "@shared/business-finance";
import { AppError } from "@shared/errors/app-error.js";
import { orderFields } from "@shared/schemas/business";
import {
  type createOrderFields,
  type OrderLineInput,
  orderLinesFields,
  type updateOrderFields,
} from "@shared/schemas/order-lines";
import type { z } from "zod";
import { parseInput } from "../utils/parse-input";
import { validateCategory } from "./catalog-category.service";

type DB = PrismaClient | Prisma.TransactionClient;
export const ORDER_INCLUDE = {
  supplier: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true } },
  part: { select: { id: true, name: true } },
  job: { select: { id: true, jobCode: true } },
  lines: {
    orderBy: { position: "asc" as const },
    include: {
      supplier: { select: { id: true, name: true } },
      part: { select: { id: true, name: true } },
    },
  },
} as const;
async function validateReferences(
  db: DB,
  header: z.infer<typeof orderFields>,
  lines: OrderLineInput[]
) {
  await validateCategory(db, "ORDER", header.customCategoryId);
  const suppliers = [
    ...new Set(
      [header.supplierId, ...lines.map((line) => line.supplierId)].filter(
        (id): id is string => !!id
      )
    ),
  ];
  const parts = [
    ...new Set(
      [header.partId, ...lines.map((line) => line.partId)].filter(
        (id): id is string => !!id
      )
    ),
  ];
  const references = [
    ...suppliers.map((id) =>
      db.supplier.findUnique({ where: { id }, select: { id: true } })
    ),
    ...parts.map((id) =>
      db.partsCatalog.findUnique({ where: { id }, select: { id: true } })
    ),
    header.customerId
      ? db.customer.findUnique({
          where: { id: header.customerId },
          select: { id: true },
        })
      : true,
    header.jobId
      ? db.job.findUnique({ where: { id: header.jobId }, select: { id: true } })
      : true,
  ];
  if ((await Promise.all(references)).some((row) => !row)) {
    throw new AppError("NOT_FOUND");
  }
  if (header.partId && header.kind !== "PART") {
    throw new AppError("VALIDATION_ERROR");
  }
}
function lineData(line: OrderLineInput, position: number) {
  const { id: _id, ...data } = line;
  return { ...data, position };
}
function legacyLine(header: z.infer<typeof orderFields>): OrderLineInput {
  return {
    name: header.title,
    quantity: 1,
    partId: header.partId,
    supplierId: header.supplierId,
    reference: header.reference ?? "",
    purchaseUrl: header.purchaseUrl,
    costGross: header.costGross,
    quoteGross: header.quoteGross,
    costVatRate: header.costVatRate,
    saleVatRate: header.saleVatRate,
    recoverInputVat: header.recoverInputVat,
  };
}
export function createOrder(
  prisma: PrismaClient,
  input: z.infer<typeof createOrderFields>
) {
  return prisma.$transaction(async (tx) => {
    const { lines: submitted, ...header } = input;
    const lines = submitted ?? [legacyLine(header)];
    if (lines.some((line) => line.id)) {
      throw new AppError("VALIDATION_ERROR");
    }
    await validateReferences(tx, header, lines);
    const totals = orderLinesTotals(lines);
    return tx.purchaseOrder.create({
      data: {
        ...header,
        costGross: totals.costGross,
        quoteGross: totals.quoteGross,
        lines: { create: lines.map(lineData) },
      },
      include: ORDER_INCLUDE,
    });
  });
}
const MONEY_FIELDS = [
  "costGross",
  "quoteGross",
  "costVatRate",
  "saleVatRate",
  "recoverInputVat",
] as const;
function storedLine(line: {
  id: string;
  name: string;
  quantity: number;
  partId: string | null;
  supplierId: string | null;
  reference: string | null;
  purchaseUrl: string | null;
  costGross: { toString(): string };
  quoteGross: { toString(): string };
  costVatRate: { toString(): string };
  saleVatRate: { toString(): string };
  recoverInputVat: boolean;
  costKnown?: boolean;
}): OrderLineInput {
  return {
    costKnown: line.costKnown ?? true,
    id: line.id,
    name: line.name,
    quantity: line.quantity,
    partId: line.partId,
    supplierId: line.supplierId,
    recoverInputVat: line.recoverInputVat,
    reference: line.reference ?? "",
    purchaseUrl: line.purchaseUrl ?? "",
    costGross: line.costGross.toString(),
    quoteGross: line.quoteGross.toString(),
    costVatRate: line.costVatRate.toString(),
    saleVatRate: line.saleVatRate.toString(),
  };
}
export function updateOrder(
  prisma: PrismaClient,
  id: string,
  input: z.infer<typeof updateOrderFields>,
  submittedKeys: string[]
) {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM purchase_orders WHERE id = ${id} FOR UPDATE`;
    if (!locked.length) {
      throw new AppError("NOT_FOUND");
    }
    const existing = await tx.purchaseOrder.findUniqueOrThrow({
      where: { id },
      include: ORDER_INCLUDE,
    });
    if (
      input.expectedUpdatedAt &&
      existing.updatedAt.getTime() !==
        new Date(input.expectedUpdatedAt).getTime()
    ) {
      throw new AppError("CONFLICT");
    }
    const { lines: submitted, expectedUpdatedAt: _version, ...values } = input;
    const patch = Object.fromEntries(
      Object.entries(values).filter(([key]) => submittedKeys.includes(key))
    );
    const header = parseInput(orderFields, {
      ...existing,
      costGross: "0",
      quoteGross: "0",
      costVatRate: existing.costVatRate.toString(),
      saleVatRate: existing.saleVatRate.toString(),
      ...patch,
    });
    let lines = submitted ?? existing.lines.map(storedLine);
    if (
      !submitted &&
      MONEY_FIELDS.some((field) => submittedKeys.includes(field))
    ) {
      if (lines.length !== 1 || lines[0].quantity !== 1) {
        throw new AppError("VALIDATION_ERROR");
      }
      lines = [
        {
          ...lines[0],
          ...Object.fromEntries(
            MONEY_FIELDS.filter((field) => submittedKeys.includes(field)).map(
              (field) => [field, header[field]]
            )
          ),
        },
      ];
    }
    lines = parseInput(orderLinesFields, lines);
    const existingIds = new Set(existing.lines.map((line) => line.id));
    if (lines.some((line) => line.id && !existingIds.has(line.id))) {
      throw new AppError("VALIDATION_ERROR");
    }
    await validateReferences(tx, header, lines);
    const totals = orderLinesTotals(lines);
    return tx.purchaseOrder.update({
      where: { id },
      data: {
        ...header,
        updatedAt: new Date(
          Math.max(Date.now(), existing.updatedAt.getTime() + 1)
        ),
        costGross: totals.costGross,
        quoteGross: totals.quoteGross,
        lines: {
          deleteMany: {
            id: { notIn: lines.flatMap((line) => (line.id ? [line.id] : [])) },
          },
          update: lines.flatMap((line, position) =>
            line.id
              ? [{ where: { id: line.id }, data: lineData(line, position) }]
              : []
          ),
          create: lines.flatMap((line, position) =>
            line.id ? [] : [lineData(line, position)]
          ),
        },
      },
      include: ORDER_INCLUDE,
    });
  });
}
