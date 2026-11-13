/* E2E orchestrator: starts the real-backend and failing-backend harnesses,
   runs every browser suite, and exits non-zero if any check fails.
   Usage: node tests/e2e/run.mjs   (CHROME_PATH=/usr/bin/google-chrome to use system Chrome) */
import { spawn, execSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const PY = process.env.PYTHON || "python3";

function waitPort(port, tries = 40) {
  return new Promise((res, rej) => {
    const ping = async (n) => {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/api/history`);
        if (r.status < 600) return res();
      } catch { /* not up yet */ }
      n > 0 ? setTimeout(() => ping(n - 1), 250) : rej(new Error(`port ${port} never came up`));
    };
    ping(tries);
  });
}

rmSync("/tmp/verity-e2e-store", { recursive: true, force: true });
const servers = [
  spawn(PY, [join(DIR, "harness_real.py")], { stdio: "inherit" }),
  spawn(PY, [join(DIR, "harness_500.py")], { stdio: "inherit" }),
];
process.on("exit", () => servers.forEach(s => s.kill()));

await Promise.all([waitPort(8899), waitPort(8898)]);

const suites = readdirSync(DIR).filter(f => /^\d\d-.*\.mjs$/.test(f)).sort();
let failed = 0;
for (const f of suites) {
  console.log(`\n━━━ ${f} ━━━`);
  let out = "";
  try {
    out = execSync(`node ${join(DIR, f)}`, { encoding: "utf8", timeout: 300000, env: process.env });
  } catch (e) {
    out = (e.stdout || "") + (e.stderr || "");
    failed++;
  }
  process.stdout.write(out);
  if (/✗|PAGEERROR|ERRORS: (?!none)/.test(out)) { failed++; console.log(`✗ ${f} has failures`); }
}
console.log(failed ? `\n✗ E2E FAILED (${failed} suite problem${failed > 1 ? "s" : ""})` : "\n✓ ALL E2E SUITES PASSED");
process.exit(failed ? 1 : 0);
