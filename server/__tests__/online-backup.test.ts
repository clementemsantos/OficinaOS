import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DATE_PREFIX = /^20/;

async function backupFixture(remoteType = "crypt", failUpload = false) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "oficina-backup-"));
  const bin = path.join(root, "bin");
  const uploads = path.join(root, "uploads");
  await fs.mkdir(bin);
  await fs.mkdir(path.join(uploads, ".documents"), { recursive: true });
  await fs.writeFile(
    path.join(uploads, ".documents", "invoice"),
    "private PDF"
  );
  await fs.writeFile(
    path.join(root, "recovery.env"),
    "AI_ENCRYPTION_KEY=offline-recovery-secret\n"
  );
  await fs.writeFile(
    path.join(bin, "pg_dump"),
    `#!/bin/sh\nfor item in "$@"; do case "$item" in --file=*) target=$(printf '%s' "$item" | cut -c8-); printf dump > "$target";; esac; done\n`,
    { mode: 0o755 }
  );
  await fs.writeFile(path.join(bin, "pg_restore"), "#!/bin/sh\nexit 0\n", {
    mode: 0o755,
  });
  await fs.writeFile(
    path.join(bin, "rclone"),
    `#!/bin/sh\nprintf '%s\\n' "$1" >> "$TEST_ROOT/rclone-calls"\ncase "$1" in\nconfig) if [ "$3" = oficina-drive ]; then printf 'type = drive\\n'; else printf 'type = ${remoteType}\\nremote = oficina-drive:OficinaOS-backups\\n'; fi;;\ncopy) ${failUpload ? "exit 1" : "exit 0"};;\ncheck) exit 0;;\nesac\n`,
    { mode: 0o755 }
  );
  const result = spawnSync("sh", [path.resolve("scripts/full-backup.sh")], {
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      TEST_ROOT: root,
      UPLOAD_SOURCE: uploads,
      RECOVERY_FILE: path.join(root, "recovery.env"),
      BACKUP_ROOT: path.join(root, "backups"),
      STATUS_ROOT: path.join(root, "status"),
      BACKUP_REMOTE: "oficina-crypt:",
    },
    encoding: "utf8",
  });
  return { root, result };
}
describe("full backup runner", () => {
  it("includes private uploads and recovery configuration and checks the remote copy", async () => {
    const { root, result } = await backupFixture();
    try {
      expect(result.status, result.stderr).toBe(0);
      const folder = (await fs.readdir(path.join(root, "backups"))).find(
        (name) => name.startsWith("20")
      );
      expect(folder).toBeTruthy();
      const archive = path.join(root, "backups", folder ?? "");
      const listing = spawnSync(
        "tar",
        ["-tzf", path.join(archive, "uploads.tar.gz")],
        { encoding: "utf8" }
      );
      expect(listing.stdout).toContain(".documents/invoice");
      expect(
        await fs.readFile(path.join(archive, "recovery.env"), "utf8")
      ).toContain("AI_ENCRYPTION_KEY");
      expect(await fs.readFile(path.join(root, "rclone-calls"), "utf8")).toBe(
        "config\nconfig\nconfig\ncopy\ncheck\n"
      );
      expect(
        await fs.readFile(
          path.join(root, "status", "last-remote-verified.txt"),
          "utf8"
        )
      ).toMatch(DATE_PREFIX);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
  it.each([
    "unencrypted",
    "failed upload",
  ])("does not report online success for %s", async (reason) => {
    const { root, result } = await backupFixture(
      reason === "unencrypted" ? "drive" : "crypt",
      reason === "failed upload"
    );
    try {
      expect(result.status).not.toBe(0);
      await expect(
        fs.stat(path.join(root, "status", "last-remote-verified.txt"))
      ).rejects.toMatchObject({ code: "ENOENT" });
      expect(
        await fs.readFile(path.join(root, "status", "last-local.txt"), "utf8")
      ).toMatch(DATE_PREFIX);
      expect(
        await fs.readFile(path.join(root, "status", "last-failure.txt"), "utf8")
      ).toMatch(DATE_PREFIX);
      expect(result.stdout).not.toContain("offline-recovery-secret");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
