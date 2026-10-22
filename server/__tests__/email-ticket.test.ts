import { describe, expect, it, vi } from "vitest";
import { parseInboxMessage } from "../services/email-inbox.service.js";
import { messageToTicket } from "../services/message-ticket.service.js";

describe("email capture and tickets", () => {
  it("decodes MIME text and attachments without requiring HTML rendering", async () => {
    const source = Buffer.from(
      [
        "From: Ana <ana@example.invalid>",
        "Subject: =?UTF-8?B?UmVwYXJhw6fDo28=?=",
        "MIME-Version: 1.0",
        'Content-Type: multipart/mixed; boundary="example"',
        "",
        "--example",
        "Content-Type: text/plain; charset=utf-8",
        "",
        "Preciso da reparacao.",
        "--example",
        'Content-Type: application/pdf; name="invoice.pdf"',
        "Content-Transfer-Encoding: base64",
        'Content-Disposition: attachment; filename="invoice.pdf"',
        "",
        Buffer.from("%PDF-test").toString("base64"),
        "--example--",
      ].join("\r\n")
    );
    const mail = await parseInboxMessage(source);
    expect(mail.body).toContain("Preciso da reparacao.");
    expect(mail.address).toBe("ana@example.invalid");
    expect(mail.attachments[0].filename).toBe("invoice.pdf");
    expect(mail.attachments[0].content.toString()).toBe("%PDF-test");
    await expect(
      parseInboxMessage(Buffer.alloc(5 * 1024 * 1024 + 1))
    ).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
  });
  it("converts once, preserves the source, and shares its attachments with the ticket", async () => {
    let linked: { entityId: string } | null = null;
    const db = {
      $queryRaw: vi.fn(async () => [{ id: "m1" }]),
      $transaction: vi.fn(),
      businessMessage: {
        findUniqueOrThrow: vi.fn(async () => ({
          subject: "Repair",
          body: "Details",
          customerId: "c1",
          supplierId: null,
        })),
      },
      businessMessageLink: {
        findFirst: vi.fn(() => Promise.resolve(linked)),
        create: vi.fn(async () => {
          linked = { entityId: "ticket1" };
          await Promise.resolve();
        }),
      },
      supportTicket: {
        create: vi.fn(async () => ({ id: "ticket1" })),
        findUniqueOrThrow: vi.fn(async () => ({ id: "ticket1" })),
      },
      documentLink: {
        findMany: vi.fn(async () => [{ documentId: "invoice1" }]),
        createMany: vi.fn(async (_input: unknown) => ({ count: 1 })),
      },
    };
    db.$transaction.mockImplementation((run) => run(db));
    expect(await messageToTicket(db as never, "m1", "owner1")).toEqual({
      id: "ticket1",
    });
    await messageToTicket(db as never, "m1", "owner1");
    expect(db.supportTicket.create).toHaveBeenCalledTimes(1);
    expect(db.documentLink.createMany).toHaveBeenCalledWith({
      data: [
        { documentId: "invoice1", entityType: "TICKET", entityId: "ticket1" },
      ],
      skipDuplicates: true,
    });
  });
});
