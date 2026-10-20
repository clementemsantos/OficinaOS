import { describe, expect, it, vi } from "vitest";
import { syncInbox } from "../services/email-inbox.service.js";

const mocks = vi.hoisted(() => ({
  release: vi.fn(),
  connect: vi.fn(() => Promise.resolve()),
  close: vi.fn(),
  on: vi.fn(),
  search: vi.fn(),
  fetchAll: vi.fn(),
  getMailboxLock: vi.fn(),
  mailbox: { uidValidity: 1n, uidNext: 1_000_000 },
}));
vi.mock("imapflow", () => ({
  ImapFlow: vi.fn(function client() {
    return mocks;
  }),
}));
vi.mock("../lib/integration-network.js", () => ({
  publicHost: () => Promise.resolve({ address: "8.8.8.8", family: 4 }),
}));
const settings = {
  host: "mail.example.invalid",
  port: 993 as const,
  user: "shop@example.invalid",
  password: "app-password",
  folder: "INBOX",
  since: "2026-10-01T00:00:00Z",
};
describe("bounded IMAP batches", () => {
  it("uses date search and advances across large UID gaps without missing matching messages", async () => {
    const ids = Array.from({ length: 12 }, (_, index) => 900_000 + index * 100);
    mocks.getMailboxLock.mockResolvedValue({ release: mocks.release });
    mocks.search.mockResolvedValue([...ids].reverse());
    mocks.fetchAll.mockResolvedValue(
      ids.slice(0, 10).map((uid) => ({
        uid,
        size: 100,
        internalDate: new Date("2026-10-02T00:00:00Z"),
      }))
    );
    const db = {
      integrationReceipt: {
        findUnique: vi.fn(async () => ({ recordId: "already-imported" })),
      },
    };
    const result = await syncInbox(db as never, settings, null, "owner1");
    expect(JSON.parse(result.cursor)).toEqual({ validity: "1", uid: 900_900 });
    expect(mocks.fetchAll).toHaveBeenCalledWith(
      ids.slice(0, 10).join(","),
      { uid: true, size: true, internalDate: true },
      { uid: true }
    );
    expect(mocks.getMailboxLock).toHaveBeenCalledWith("INBOX", {
      readOnly: true,
    });
    expect(mocks.release).toHaveBeenCalled();
    expect(mocks.close).toHaveBeenCalled();
  });
  it("does not refetch old UID gaps when the mailbox has no matches", async () => {
    mocks.search.mockResolvedValue([]);
    mocks.fetchAll.mockClear();
    const result = await syncInbox({} as never, settings, null, "owner1");
    expect(JSON.parse(result.cursor).uid).toBe(999_999);
    expect(mocks.fetchAll).not.toHaveBeenCalled();
  });
});
