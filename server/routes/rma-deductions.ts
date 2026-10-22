import { AppError } from "@shared/errors/app-error.js";
import {
  rmaDeduction,
  rmaDeductionUndo,
  rmaSource,
} from "@shared/schemas/rma-deduction";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import { requirePermission } from "../middlewares/rbac.js";
import {
  applyRmaDeduction,
  rmaCandidates,
  undoRmaDeduction,
} from "../services/rma-deduction.service.js";
import { parseInput } from "../utils/parse-input.js";
import { getRole, getUserId } from "../utils/request.js";

async function authorizeSource(req: FastifyRequest, kind: "JOB" | "SALE") {
  const permissions =
    kind === "JOB"
      ? { jobs: ["edit"] as ["edit"] }
      : { sales: ["create"] as ["create"] };
  const allowed = await req.server.auth.api.userHasPermission({
    body: { role: getRole(req), permissions },
  });
  if (!allowed.success) {
    throw new AppError("FORBIDDEN");
  }
}
export const rmaDeductionRoutes: FastifyPluginAsync = (app) => {
  app.addHook(
    "preHandler",
    requirePermission({ parts: ["manageCatalog", "viewCost"] })
  );
  app.get("/:id/deduction-candidates", async (req) => {
    const { id } = parseInput(z.object({ id: z.string().min(1) }), req.params);
    const source = parseInput(rmaSource, req.query);
    await authorizeSource(req, source.kind);
    return { data: await rmaCandidates(app.prisma, id, source) };
  });
  app.post("/:id/deduct-piece", async (req) => {
    const { id } = parseInput(z.object({ id: z.string().min(1) }), req.params);
    const input = parseInput(rmaDeduction, req.body);
    await authorizeSource(req, input.kind);
    await applyRmaDeduction(app.prisma, id, input, getUserId(req));
    return { saved: true };
  });
  app.post("/:id/restore-piece-value", async (req) => {
    const { id } = parseInput(z.object({ id: z.string().min(1) }), req.params);
    const { expectedUpdatedAt } = parseInput(rmaDeductionUndo, req.body);
    const rma = await app.prisma.supplierRma.findUnique({ where: { id } });
    if (!rma) {
      throw new AppError("NOT_FOUND");
    }
    await authorizeSource(
      req,
      rma.deductedJobPartId || rma.jobId ? "JOB" : "SALE"
    );
    await undoRmaDeduction(app.prisma, id, expectedUpdatedAt, getUserId(req));
    return { saved: true };
  });
  return Promise.resolve();
};
