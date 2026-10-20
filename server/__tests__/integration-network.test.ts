import dns from "node:dns/promises";
import { EventEmitter } from "node:events";
import https from "node:https";
import { describe, expect, it, vi } from "vitest";
import { integrationJson } from "../lib/integration-network.js";

vi.mock("node:dns/promises", () => ({ default: { lookup: vi.fn() } }));
vi.mock("node:https", () => ({ default: { get: vi.fn() } }));
describe("integration HTTPS boundary", () => {
  it("pins the validated address for both single-address and auto-family lookups", async () => {
    vi.mocked(dns.lookup).mockResolvedValue([
      { address: "8.8.8.8", family: 4 },
    ] as never);
    const request = new EventEmitter();
    vi.mocked(https.get).mockImplementation((...args) => {
      const options = args[1] as https.RequestOptions;
      const single = vi.fn();
      const all = vi.fn();
      options.lookup?.("shop.example.invalid", {}, single);
      options.lookup?.("shop.example.invalid", { all: true }, all);
      expect(single).toHaveBeenCalledWith(null, "8.8.8.8", 4);
      expect(all).toHaveBeenCalledWith(null, [
        { address: "8.8.8.8", family: 4 },
      ]);
      expect(options.headers).toMatchObject({
        Authorization: "Basic protected",
      });
      expect(options.signal).toBeInstanceOf(AbortSignal);
      const response = Object.assign(new EventEmitter(), { statusCode: 200 });
      const callback = args[2] as (response: unknown) => void;
      queueMicrotask(() => {
        callback(response);
        response.emit("data", Buffer.from("[]"));
        response.emit("end");
      });
      return request as never;
    });
    expect(
      await integrationJson(
        new URL("https://shop.example.invalid/orders"),
        "Basic protected"
      )
    ).toEqual([]);
  });
  it("refuses private DNS answers before any credentials are sent", async () => {
    vi.mocked(https.get).mockClear();
    vi.mocked(dns.lookup).mockResolvedValue([
      { address: "192.168.0.7", family: 4 },
    ] as never);
    await expect(
      integrationJson(
        new URL("https://shop.example.invalid"),
        "Basic protected"
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(https.get).not.toHaveBeenCalled();
  });
});
