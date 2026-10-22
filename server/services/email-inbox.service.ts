import type { PrismaClient } from "@generated/client";
import { AppError } from "@shared/errors/app-error.js";
import type { emailSettings } from "@shared/schemas/integrations";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { z } from "zod";
import { publicHost } from "../lib/integration-network.js";
import { DOCUMENT_LIMIT, storeDocument } from "./documents.service.js";

export async function parseInboxMessage(source: Buffer) {
  if (source.length > DOCUMENT_LIMIT) {
    throw new AppError("FILE_TOO_LARGE");
  }
  const mail = await simpleParser(source, {
    skipHtmlToText: false,
    skipTextToHtml: true,
    skipImageLinks: true,
    skipTextLinks: true,
    maxHtmlLengthToParse: DOCUMENT_LIMIT,
  });
  return {
    subject: (mail.subject || "(sem assunto)").slice(0, 200),
    body: (mail.text || "(mensagem sem texto; consultar original.eml)").slice(
      0,
      30_000
    ),
    correspondent: (mail.from?.text ?? "").slice(0, 300),
    address: mail.from?.value[0]?.address,
    receivedAt:
      mail.date && Number.isFinite(mail.date.getTime())
        ? mail.date
        : new Date(),
    attachments: mail.attachments,
  };
}
export async function syncInbox(
  prisma: PrismaClient,
  settings: z.infer<typeof emailSettings>,
  cursor: string | null,
  userId: string
) {
  const address = await publicHost(settings.host);
  const client = new ImapFlow({
    host: address.address,
    servername: settings.host,
    port: settings.port,
    secure: true,
    tls: { servername: settings.host, rejectUnauthorized: true },
    auth: { user: settings.user, pass: settings.password },
    logger: false,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    disableAutoIdle: true,
  });
  client.on("error", () => {
    /* The awaited command reports a redacted sync error. */
  });
  try {
    await client.connect();
    const lock = await client.getMailboxLock(settings.folder, {
      readOnly: true,
    });
    try {
      const { validity, nextUid, metadata } = await inboxBatch(
        client,
        settings.since,
        cursor
      );
      const source = `IMAP:${settings.host}:${settings.user}:${settings.folder}:${validity}`;
      let imported = 0;
      for (const info of metadata) {
        if (
          info.internalDate &&
          new Date(info.internalDate).getTime() <
            new Date(settings.since).getTime()
        ) {
          continue;
        }
        if (
          await prisma.integrationReceipt.findUnique({
            where: {
              source_externalId: { source, externalId: String(info.uid) },
            },
          })
        ) {
          continue;
        }
        if (info.size && info.size > DOCUMENT_LIMIT) {
          throw new AppError("FILE_TOO_LARGE");
        }
        const fetched = await client.fetchAll(
          String(info.uid),
          { source: true },
          { uid: true }
        );
        const bytes = fetched[0]?.source;
        if (!bytes) {
          continue;
        }
        const mail = await parseInboxMessage(bytes);
        const customers = mail.address
          ? await prisma.customer.findMany({
              where: { email: { equals: mail.address, mode: "insensitive" } },
              select: { id: true },
              take: 2,
            })
          : [];
        await prisma.$transaction(
          async (tx) => {
            const message = await tx.businessMessage.create({
              data: {
                channel: "EMAIL",
                direction: "INBOUND",
                deliveryStatus: "CAPTURED",
                subject: mail.subject,
                body: mail.body,
                correspondent: mail.correspondent,
                receivedAt: mail.receivedAt,
                createdById: userId,
                customerId: customers.length === 1 ? customers[0].id : null,
              },
            });
            await storeDocument(
              tx,
              "original.eml",
              bytes,
              "MESSAGE",
              message.id
            );
            for (const attachment of mail.attachments) {
              await storeDocument(
                tx,
                attachment.filename || "attachment",
                attachment.content,
                "MESSAGE",
                message.id
              );
            }
            await tx.integrationReceipt.create({
              data: {
                source,
                externalId: String(info.uid),
                recordId: message.id,
              },
            });
          },
          { timeout: 30_000 }
        );
        imported++;
      }
      return { imported, cursor: JSON.stringify({ validity, uid: nextUid }) };
    } finally {
      lock.release();
    }
  } finally {
    client.close();
  }
}

async function inboxBatch(
  client: ImapFlow,
  since: string,
  cursor: string | null
) {
  const box = client.mailbox;
  if (!box) {
    throw new AppError("VALIDATION_ERROR");
  }
  const validity = String(box.uidValidity);
  const previous: { validity: string; uid: number } | null = cursor
    ? JSON.parse(cursor)
    : null;
  const low = previous?.validity === validity ? previous.uid + 1 : 1;
  const high = box.uidNext - 1;
  if (high < low) {
    return { validity, nextUid: low - 1, metadata: [] };
  }
  // Search on the server rather than walking years of old UID slots.
  const matches = await client.search(
    {
      uid: `${low}:${high}`,
      since: new Date(new Date(since).getTime() - 86_400_000),
    },
    { uid: true }
  );
  const available = (matches || [])
    .filter((uid) => uid >= low && uid <= high)
    .sort((left, right) => left - right);
  const selected = available.slice(0, 10);
  const nextUid =
    available.length > selected.length ? (selected.at(-1) ?? high) : high;
  const metadata = selected.length
    ? await client.fetchAll(
        selected.join(","),
        { uid: true, size: true, internalDate: true },
        { uid: true }
      )
    : [];

  return { validity, nextUid, metadata };
}
