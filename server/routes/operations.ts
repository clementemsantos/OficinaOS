import { Prisma } from "@generated/client";
import { retentionQuery, warrantyQuery } from "@shared/schemas/operations";
import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";
import { parseInput } from "../utils/parse-input.js";

function page<T extends { id: string }>(rows: T[]) {
  return {
    data: rows.slice(0, 50),
    nextCursor: rows.length > 50 ? rows[49].id : null,
  };
}

export const operationsRoutes: FastifyPluginAsync = (app) => {
  // This surface combines shop-wide customers, purchasing and costs.
  app.addHook("preHandler", requirePermission({ settings: ["edit"] }));

  app.get("/retention", async (req) => {
    const { days, q, cursor } = parseInput(retentionQuery, req.query);
    const cutoff = new Date(Date.now() - days * 86_400_000);
    const rows = await app.prisma.$queryRaw<
      {
        id: string;
        name: string;
        lastActivity: Date;
        jobs: number;
        sales: number;
        orders: number;
        messagingConsent: boolean;
      }[]
    >(Prisma.sql`
      WITH activity AS (
        SELECT "customerId", "updatedAt" AS "createdAt", 'job' AS kind FROM jobs
        UNION ALL SELECT "customerId", "createdAt", 'sale' FROM sales WHERE "customerId" IS NOT NULL
        UNION ALL SELECT "customerId", "updatedAt", 'order' FROM purchase_orders WHERE "customerId" IS NOT NULL
      ), summary AS (
        SELECT "customerId", MAX("createdAt") AS "lastActivity",
          COUNT(*) FILTER (WHERE kind = 'job')::int AS jobs,
          COUNT(*) FILTER (WHERE kind = 'sale')::int AS sales,
          COUNT(*) FILTER (WHERE kind = 'order')::int AS orders
        FROM activity GROUP BY "customerId"
      )
      SELECT c.id, c.name, s."lastActivity", s.jobs, s.sales, s.orders, c."whatsappConsent" AS "messagingConsent"
      FROM customers c JOIN summary s ON s."customerId" = c.id
      WHERE s."lastActivity" < ${cutoff}
        AND NOT EXISTS (SELECT 1 FROM jobs j WHERE j."customerId" = c.id AND j.status NOT IN ('DELIVERED', 'CANCELLED', 'RETURNED'))
        AND position(lower(${q}) in lower(c.name)) > 0
        ${cursor ? Prisma.sql`AND c.id > ${cursor}` : Prisma.empty}
      ORDER BY c.id LIMIT 51
    `);
    return { ...page(rows), cutoff };
  });

  app.get("/warranties", async (req) => {
    const { q, cursor, state } = parseInput(warrantyQuery, req.query);
    const now = new Date();
    const until = new Date(now.getTime() + 30 * 86_400_000);
    const rows = await app.prisma.$queryRaw<
      {
        id: string;
        jobId: string;
        jobCode: string;
        customerId: string;
        customer: string;
        name: string;
        deliveredAt: Date | null;
        expiresAt: Date | null;
      }[]
    >(Prisma.sql`
      WITH deliveries AS (
        SELECT "jobId", MIN("createdAt") AS delivered FROM audit_logs
        WHERE action = 'STATUS_CHANGED' AND "toValue" = 'DELIVERED' GROUP BY "jobId"
      ), warranties AS (
        SELECT jr.id, j.id AS "jobId", j."jobCode", c.id AS "customerId", c.name AS customer,
          jr."repairName" AS name, d.delivered AS "deliveredAt",
          d.delivered + make_interval(days => COALESCE(r."warrantyDays", (SELECT "defaultWarrantyDays" FROM shop_settings LIMIT 1), 30)) AS "expiresAt"
        FROM job_repairs jr JOIN jobs j ON j.id = jr."jobId" JOIN customers c ON c.id = j."customerId"
        LEFT JOIN repair_catalog r ON r.id = jr."repairId" LEFT JOIN deliveries d ON d."jobId" = j.id
        WHERE j.status = 'DELIVERED'
      ) SELECT * FROM warranties WHERE position(lower(${q}) in lower("jobCode" || ' ' || customer || ' ' || name)) > 0
      ${cursor ? Prisma.sql`AND id > ${cursor}` : Prisma.empty}
      ${state === "UNKNOWN" ? Prisma.sql`AND "expiresAt" IS NULL` : Prisma.empty}
      ${state === "ACTIVE" ? Prisma.sql`AND "expiresAt" >= ${now}` : Prisma.empty}
      ${state === "EXPIRED" ? Prisma.sql`AND "expiresAt" < ${now}` : Prisma.empty}
      ${state === "EXPIRING" ? Prisma.sql`AND "expiresAt" >= ${now} AND "expiresAt" <= ${until}` : Prisma.empty}
      ORDER BY id LIMIT 51
    `);
    return { ...page(rows), checkedAt: now };
  });
  return Promise.resolve();
};
