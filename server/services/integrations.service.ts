import type { PrismaClient } from "@generated/client";
import { AppError } from "@shared/errors/app-error.js";
import { emailSettings, wooSettings } from "@shared/schemas/integrations";
import { decryptSecret } from "../lib/crypto.js";
import { syncInbox } from "./email-inbox.service.js";
import { syncWoo } from "./woocommerce.service.js";

// Database lease prevents overlap across requests and replicas. No raw provider errors/secrets persist.
export async function syncIntegration(
  prisma: PrismaClient,
  kind: string,
  automatic = false
) {
  const lease = new Date(Date.now() + 60 * 60_000);
  const locked = await prisma.integrationConnection.updateMany({
    where: {
      kind,
      ...(automatic ? { enabled: true } : {}),
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
    },
    data: { leaseUntil: lease },
  });
  if (!locked.count) {
    throw new AppError("CONFLICT");
  }
  try {
    const row = await prisma.integrationConnection.findUniqueOrThrow({
      where: { kind },
    });
    const settings = JSON.parse(decryptSecret(row.settings));
    const result =
      kind === "WOOCOMMERCE"
        ? await syncWoo(prisma, wooSettings.parse(settings), row.cursor)
        : await syncInbox(
            prisma,
            emailSettings.parse(settings),
            row.cursor,
            settings.userId
          );
    await prisma.integrationConnection.updateMany({
      where: { kind, leaseUntil: lease },
      data: { cursor: result.cursor, lastSyncAt: new Date(), lastError: null },
    });
    return { imported: result.imported };
  } catch {
    await prisma.integrationConnection.updateMany({
      where: { kind, leaseUntil: lease },
      data: { lastError: "integrations.failed" },
    });
    throw new AppError("VALIDATION_ERROR");
  } finally {
    await prisma.integrationConnection.updateMany({
      where: { kind, leaseUntil: lease },
      data: { leaseUntil: null },
    });
  }
}
