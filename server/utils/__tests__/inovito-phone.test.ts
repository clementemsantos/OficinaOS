import { describe, expect, it } from "vitest";
import { normalizeInovitoPhone } from "../inovito-phone.js";

describe("normalizeInovitoPhone", () => {
  it("normalizes Portuguese mobiles without prefix", () => {
    expect(normalizeInovitoPhone("912 345 678")).toBe("+351912345678");
  });

  it("normalizes Portuguese numbers with international prefix", () => {
    expect(normalizeInovitoPhone("00351 912 345 678")).toBe("+351912345678");
    expect(normalizeInovitoPhone("351912345678")).toBe("+351912345678");
  });

  it("accepts valid E.164 numbers", () => {
    expect(normalizeInovitoPhone("+442012345678")).toBe("+442012345678");
  });

  it("rejects hidden, empty and malformed caller IDs", () => {
    for (const raw of [
      "",
      "private",
      "unknown",
      "123",
      "9999999999999999999999",
    ]) {
      expect(normalizeInovitoPhone(raw)).toBeNull();
    }
  });
});
