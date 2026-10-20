import type { PrismaClient } from "@generated/client";
import { AppError } from "@shared/errors/app-error.js";
export function messageToTicket(
  prisma: PrismaClient,
  messageId: string,
  userId: string
) {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM business_messages WHERE id = ${messageId} FOR UPDATE`;
    if (!locked.length) {
      throw new AppError("NOT_FOUND");
    }
    const existing = await tx.businessMessageLink.findFirst({
      where: { messageId, entityType: "TICKET" },
    });
    if (existing) {
      return tx.supportTicket.findUniqueOrThrow({
        where: { id: existing.entityId },
      });
    }
    const message = await tx.businessMessage.findUniqueOrThrow({
      where: { id: messageId },
    });
    const ticket = await tx.supportTicket.create({
      data: {
        title: message.subject.slice(0, 200),
        description: message.body.slice(0, 20_000),
        area: "EMAIL",
        priority: "NORMAL",
        customerId: message.customerId,
        supplierId: message.supplierId,
        createdById: userId,
      },
    });
    await tx.businessMessageLink.create({
      data: { messageId, entityType: "TICKET", entityId: ticket.id },
    });
    const documents = await tx.documentLink.findMany({
      where: { entityType: "MESSAGE", entityId: messageId },
    });
    if (documents.length) {
      await tx.documentLink.createMany({
        data: documents.map((row) => ({
          documentId: row.documentId,
          entityType: "TICKET",
          entityId: ticket.id,
        })),
        skipDuplicates: true,
      });
    }
    return ticket;
  });
}
