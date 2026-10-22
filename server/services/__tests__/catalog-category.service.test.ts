import { describe, expect, it, vi } from "vitest";
import { saveCategory, validateCategory } from "../catalog-category.service.js";

function build() {
  const nodes = [
    {
      id: "root",
      scope: "PART",
      name: "Computers",
      parentId: null,
      isActive: true,
    },
    {
      id: "child",
      scope: "PART",
      name: "Laptops",
      parentId: "root",
      isActive: true,
    },
    {
      id: "foreign",
      scope: "REPAIR",
      name: "Diagnostics",
      parentId: null,
      isActive: true,
    },
  ];
  const tx = {
    $queryRaw: vi.fn(async () => []),
    catalogCategory: {
      findUnique: vi.fn(
        async ({ where }) => nodes.find((row) => row.id === where.id) ?? null
      ),
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }) => ({ id: "new", ...data })),
      update: vi.fn(async ({ data }) => ({ id: "root", ...data })),
    },
  };
  const prisma = {
    $transaction: vi.fn(
      async (fn: (value: typeof tx) => unknown) => await fn(tx)
    ),
    catalogCategory: tx.catalogCategory,
  };
  return { prisma: prisma as never, tx };
}
describe("hierarchical catalog categories", () => {
  it("creates subcategories with stable parent references and normalized names", async () => {
    const { prisma, tx } = build();
    await saveCategory(prisma, "PART", {
      name: "Ｔeclados",
      parentId: "child",
      isActive: true,
    });
    expect(tx.catalogCategory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        parentId: "child",
        parentKey: "child",
        nameKey: "teclados",
        scope: "PART",
      }),
    });
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
  });
  it("rejects a parent from another module", async () => {
    const { prisma, tx } = build();
    await expect(
      saveCategory(prisma, "PART", {
        name: "Keyboards",
        parentId: "foreign",
        isActive: true,
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(tx.catalogCategory.create).not.toHaveBeenCalled();
  });
  it("prevents moving a parent below one of its descendants", async () => {
    const { prisma, tx } = build();
    await expect(
      saveCategory(
        prisma,
        "PART",
        { name: "Computers", parentId: "child", isActive: true },
        "root"
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(tx.catalogCategory.update).not.toHaveBeenCalled();
  });
  it("prevents assigning a category as its own parent", async () => {
    const { prisma } = build();
    await expect(
      saveCategory(
        prisma,
        "PART",
        { name: "Computers", parentId: "root", isActive: true },
        "root"
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
  it("rejects duplicate sibling names without replacing existing categories", async () => {
    const { prisma, tx } = build();
    tx.catalogCategory.findFirst.mockResolvedValue({ id: "existing" } as never);
    await expect(
      saveCategory(prisma, "PART", {
        name: "Keyboards",
        parentId: "child",
        isActive: true,
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(tx.catalogCategory.create).not.toHaveBeenCalled();
  });
  it("preserves IDs when renaming and deactivating a category", async () => {
    const { prisma, tx } = build();
    await saveCategory(
      prisma,
      "PART",
      { name: "Computer parts", parentId: null, isActive: false },
      "root"
    );
    expect(tx.catalogCategory.update).toHaveBeenCalledWith({
      where: { id: "root" },
      data: expect.objectContaining({
        name: "Computer parts",
        isActive: false,
        parentId: null,
      }),
    });
  });
  it("rejects inactive categories for new assignments", async () => {
    const { prisma, tx } = build();
    tx.catalogCategory.findUnique.mockResolvedValue({
      id: "root",
      scope: "PART",
      isActive: false,
    } as never);
    await expect(
      validateCategory(prisma, "PART", "root")
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
