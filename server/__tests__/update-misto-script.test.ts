import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sudoMock = String.raw`#!/bin/bash
case "$1" in
-v) exit 0;;
docker) shift; exec docker "$@";;
install|cp|chmod|test) exit 0;;
tee) /bin/cat > /dev/null; exit 0;;
bash) echo verify >> "$EVENTS"; [[ "\${FAIL_VERIFY:-0}" == 0 ]]; exit $?;;
*) exit 99;;
esac
`;
const dockerMock = String.raw`#!/bin/bash
case "$1" in
inspect) echo fixture-image; exit 0;;
cp) echo uploads >> "$EVENTS"; exit 0;;
exec)
  if [[ "$2" == oficinaos-misto-db-1 ]]; then echo fixture-dump; echo dump >> "$EVENTS"; exit 0; fi
  echo health >> "$EVENTS"; [[ "\${FAIL_HEALTH:-0}" == 0 ]]; exit $?;;
compose)
  for arg in "$@"; do
    case "$arg" in
      build) echo build >> "$EVENTS"; [[ "\${FAIL_BUILD:-0}" == 0 ]]; exit $?;;
      up) echo up >> "$EVENTS"; exit 0;;
      logs) echo logs >> "$EVENTS"; exit 0;;
    esac
  done;;
esac
exit 98
`;
const gitMock = String.raw`#!/bin/bash
if [[ "$1" == diff && "\${DIRTY_CODE:-0}" == 1 ]]; then echo server/index.ts; fi
exit 0
`;
function run(flags: Record<string, string | undefined>) {
  const folder = mkdtempSync(join(tmpdir(), "misto-installer-test-"));
  try {
    const repo = join(folder, "repo");
    const bin = join(folder, "bin");
    mkdirSync(join(repo, "scripts"), { recursive: true });
    mkdirSync(bin);
    const script = join(repo, "scripts", "update-misto.sh");
    copyFileSync(
      fileURLToPath(new URL("../../scripts/update-misto.sh", import.meta.url)),
      script
    );
    writeFileSync(join(repo, "compose.misto.yaml"), "# fixture");
    writeFileSync(join(repo, ".env.misto"), "# no real credentials");
    for (const [name, content] of Object.entries({
      sudo: sudoMock,
      docker: dockerMock,
      git: gitMock,
      sleep: "#!/bin/bash\nexit 0\n",
    })) {
      writeFileSync(join(bin, name), content.replaceAll("\\$", "$"), {
        mode: 0o755,
      });
    }
    const events = join(folder, "events");
    writeFileSync(events, "");
    let output = "";
    let failed = false;
    try {
      output = execFileSync("bash", [script], {
        env: {
          ...process.env,
          ...flags,
          EVENTS: events,
          PATH: `${bin}:${process.env.PATH}`,
        },
        encoding: "utf8",
      });
    } catch (error) {
      failed = true;
      output = String((error as { stdout?: string }).stdout ?? "");
    }
    return {
      output,
      failed,
      events: readFileSync(events, "utf8").trim().split("\n"),
    };
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}
describe.skipIf(process.platform === "win32")(
  "Misto installer without real Docker or sudo",
  () => {
    it("checks the backup and copies uploads before changing the app, then confirms health", () => {
      const result = run({});
      expect(result.failed).toBe(false);
      expect(result.output).toContain("health OK");
      expect(result.events).toEqual([
        "dump",
        "verify",
        "uploads",
        "build",
        "up",
        "health",
      ]);
    });
    it.each([
      { FAIL_VERIFY: "1" },
      { DIRTY_CODE: "1" },
    ])("does not build or start when a prerequisite fails: %j", (flags) => {
      const result = run(flags);
      expect(result.failed).toBe(true);
      expect(result.events).not.toContain("build");
      expect(result.events).not.toContain("up");
    });
    it("keeps the current app untouched if the new build fails", () => {
      const result = run({ FAIL_BUILD: "1" });
      expect(result.failed).toBe(true);
      expect(result.events).not.toContain("up");
      expect(result.output).not.toContain("health OK");
    });
    it("never declares success if the started app does not become healthy", () => {
      const result = run({ FAIL_HEALTH: "1" });
      expect(result.failed).toBe(true);
      expect(result.events).toContain("logs");
      expect(result.output).not.toContain("health OK");
    });
  }
);
