import dns from "node:dns/promises";
import https from "node:https";
import { AppError } from "@shared/errors/app-error.js";
import ipaddr from "ipaddr.js";

export function publicAddress(address: string) {
  if (!ipaddr.isValid(address)) {
    return false;
  }
  return ipaddr.process(address).range() === "unicast";
}
export async function publicHost(host: string) {
  const addresses = await dns.lookup(host, { all: true });
  if (
    !addresses.length ||
    addresses.some((entry) => !publicAddress(entry.address))
  ) {
    throw new AppError("VALIDATION_ERROR");
  }
  return addresses.find((entry) => entry.family === 4) ?? addresses[0];
}
/** Pinned lookup prevents DNS rebinding. Redirects never receive credentials. */
export async function integrationJson(url: URL, authorization: string) {
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port && url.port !== "443")
  ) {
    throw new AppError("VALIDATION_ERROR");
  }
  const address = await publicHost(url.hostname);
  return new Promise<unknown>((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: { Authorization: authorization, Accept: "application/json" },
        lookup: (_hostname, options, callback) => {
          if (options.all) {
            callback(null, [address]);
            return;
          }
          callback(null, address.address, address.family);
        },
        signal: AbortSignal.timeout(30_000),
        timeout: 20_000,
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.destroy();
          reject(new AppError("VALIDATION_ERROR"));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 10 * 1024 * 1024) {
            response.destroy(new AppError("FILE_TOO_LARGE"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch {
            reject(new AppError("VALIDATION_ERROR"));
          }
        });
      }
    );
    request.on("timeout", () =>
      request.destroy(new AppError("VALIDATION_ERROR"))
    );
    request.on("error", reject);
  });
}
