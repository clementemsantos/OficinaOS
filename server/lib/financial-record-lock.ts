import { AppError } from "@shared/errors/app-error.js";

const active = new Set<string>();
/** Matches the existing invoice issuer's single-instance deployment boundary. */
export function claimFinancialRecord(
  kind: "JOB" | "SALE",
  id: string,
  invoice = false
) {
  const key = `${kind}:${id}`;
  if (active.has(key)) {
    throw new AppError(invoice ? "ALREADY_INVOICED" : "CONFLICT");
  }
  active.add(key);
  return () => {
    active.delete(key);
  };
}
