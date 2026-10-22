import type { PrismaClient } from "@generated/client";
import { editReturnClaimSchema } from "@shared/schemas/return-claim.schema";
import { describe, expect, it, vi } from "vitest";
import { editReason } from "../return-claim.service";

function setup(status = "OPEN") {
  const db = {
    returnClaim: {
      findFirst: vi.fn().mockResolvedValue({ id: "r1", status }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return { db, prisma: db as unknown as PrismaClient };
}
describe("editing the reason of a return claim", () => {
  it("retains self-scope and changes only the reason while the record is open", async () => {
    const { db, prisma } = setup();
    expect(
      await editReason(prisma, "r1", "Corrected complaint", "tech1")
    ).toEqual({ id: "r1" });
    expect(db.returnClaim.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "r1",
          OR: [
            { openedById: "tech1" },
            { originalJob: { technicianId: "tech1" } },
            { reworkJob: { technicianId: "tech1" } },
          ],
        },
      })
    );
    expect(db.returnClaim.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "r1",
          status: "OPEN",
          OR: expect.any(Array),
        }),
        data: { returnReason: "Corrected complaint" },
      })
    );
  });
  it("rejects resolved claims", async () => {
    const { db, prisma } = setup("RESOLVED");
    expect(await editReason(prisma, "r1", "Changed")).toEqual({
      error: "RETURN_CLAIM_NOT_OPEN",
    });
    expect(db.returnClaim.updateMany).not.toHaveBeenCalled();
  });
  it("does not write a missing or out-of-scope claim", async () => {
    const { db, prisma } = setup();
    db.returnClaim.findFirst.mockResolvedValue(null);
    expect(await editReason(prisma, "r1", "Changed", "tech1")).toEqual({
      error: "RETURN_CLAIM_NOT_FOUND",
    });
    expect(db.returnClaim.updateMany).not.toHaveBeenCalled();
  });
  it("rejects a concurrent resolution", async () => {
    const { db, prisma } = setup();
    db.returnClaim.updateMany.mockResolvedValue({ count: 0 });
    expect(await editReason(prisma, "r1", "Changed")).toEqual({
      error: "RETURN_CLAIM_NOT_OPEN",
    });
  });
  it("rejects blank reasons and attempts to reassign historical links", () => {
    expect(
      editReturnClaimSchema.safeParse({ returnReason: "  " }).success
    ).toBe(false);
    expect(
      editReturnClaimSchema.safeParse({
        returnReason: "Changed",
        originalJobId: "other",
      }).success
    ).toBe(false);
  });
});
