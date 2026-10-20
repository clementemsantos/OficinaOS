import { INACTIVE_STATUSES } from "@shared/constants/job-statuses";
import { AppError } from "@shared/errors/app-error.js";

export function assertJobMutable(job: {
  status: string;
}): { error: "JOB_IN_TERMINAL_STATUS" } | null {
  if ((INACTIVE_STATUSES as string[]).includes(job.status)) {
    return { error: "JOB_IN_TERMINAL_STATUS" as const };
  }
  return null;
}

/** Serialize line changes with status transitions and other mutations of this job. */
export async function lockMutableJob(
  tx: import("@generated/client").Prisma.TransactionClient,
  id: string
) {
  const rows = await tx.$queryRaw<
    { status: string }[]
  >`SELECT "status" FROM "jobs" WHERE "id"=${id} FOR UPDATE`;
  const job = rows[0];
  if (!job) {
    throw new AppError("JOB_NOT_FOUND");
  }
  if (assertJobMutable(job)) {
    throw new AppError("JOB_IN_TERMINAL_STATUS");
  }
}
