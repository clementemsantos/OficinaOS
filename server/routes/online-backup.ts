import fs from "node:fs/promises";
import path from "node:path";
import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";
export const onlineBackupRoutes: FastifyPluginAsync = (app) => {
  app.get(
    "/",
    { preHandler: requirePermission({ settings: ["edit"] }) },
    async () => {
      const read = async (name: string) => {
        try {
          const value = (
            await fs.readFile(path.join("/app/backup-status", name), "utf8")
          ).trim();
          return Number.isFinite(Date.parse(value)) ? value : null;
        } catch {
          return null;
        }
      };
      const [local, remote, failure] = await Promise.all([
        read("last-local.txt"),
        read("last-remote-verified.txt"),
        read("last-failure.txt"),
      ]);
      return { local, remote, failure };
    }
  );
  return Promise.resolve();
};
