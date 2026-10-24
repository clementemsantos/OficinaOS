import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createRequestId } from "../request-id";

describe("HTTP-compatible request IDs", () => {
  it("generates distinct UUIDs with only getRandomValues available", () => {
    const crypto = globalThis.crypto;
    vi.stubGlobal("crypto", {
      getRandomValues: crypto.getRandomValues.bind(crypto),
    });
    try {
      const ids = Array.from({ length: 20 }, () => createRequestId());
      expect(new Set(ids).size).toBe(20);
      for (const id of ids) {
        expect(z.uuid().safeParse(id).success).toBe(true);
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
