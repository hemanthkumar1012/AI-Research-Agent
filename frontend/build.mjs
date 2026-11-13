#!/usr/bin/env node
/**
 * Build script — compiles TypeScript and bundles into research_agent/static/
 *
 * Since we can't rely on npm/node_modules being available at build time
 * (network restrictions), this script:
 *   1. Runs tsc to compile .ts → .js in frontend/dist/
 *   2. Concatenates all JS modules into a single IIFE bundle
 *   3. Copies CSS and HTML into research_agent/static/
 *
 * Usage: node frontend/build.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { createHash } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const FRONTEND = __dirname;
const STATIC = join(ROOT, "research_agent", "static");
const DIST = join(FRONTEND, "dist");

// ── Ensure output dirs exist ────────────────────────────
mkdirSync(STATIC, { recursive: true });
mkdirSync(DIST, { recursive: true });

// ── Step 1: Compile TypeScript ──────────────────────────
console.log("⚡ Compiling TypeScript…");
try {
  // Try using npx tsc first, fall back to direct tsc
  try {
    execSync("npx --yes tsc --version", { cwd: FRONTEND, stdio: "pipe" });
    execSync("npx --yes tsc -p tsconfig.json", { cwd: FRONTEND, stdio: "inherit" });
  } catch {
    execSync("tsc -p tsconfig.json", { cwd: FRONTEND, stdio: "inherit" });
  }
} catch (e) {
  console.error("✗ TypeScript compilation failed — fix the errors above. Not shipping a broken bundle.");
  process.exit(1);
}

// ── Step 2: Bundle all JS into single file ──────────────
console.log("📦 Bundling JavaScript…");

const MODULE_ORDER = [
  "u.js", "store.js", "net.js", "charts.js",
  "landing.js", "shell.js", "views.js", "research.js", "report.js", "main.js"
];

let bundle = `"use strict";\n(() => {\n`;

for (const mod of MODULE_ORDER) {
  const path = join(DIST, mod);
  if (!existsSync(path)) {
    console.warn(`  ⚠ Missing ${mod}, skipping`);
    continue;
  }
  let code = readFileSync(path, "utf8");

  // Remove import/export statements (we're bundling into one IIFE)
  code = code
    .replace(/^import\s+.*?from\s+["'].*?["'];?\s*$/gm, "")
    .replace(/^import\s+type\s+.*?from\s+["'].*?["'];?\s*$/gm, "")
    .replace(/^export\s+(function|class|const|let|var|async)/gm, "$1")
    .replace(/^export\s+\{[^}]*\};?\s*$/gm, "")
    .replace(/^export\s+default\s+/gm, "");

  bundle += `\n// ── ${mod} ──\n${code}\n`;
}

bundle += `\n})();\n`;

writeFileSync(join(STATIC, "app.js"), bundle);
console.log(`  ✓ app.js (${(bundle.length / 1024).toFixed(1)} KB)`);

// ── Step 3: Copy CSS ────────────────────────────────────
console.log("🎨 Copying CSS…");
const css = readFileSync(join(FRONTEND, "src", "styles.css"), "utf8");
writeFileSync(join(STATIC, "app.css"), css);
console.log(`  ✓ app.css (${(css.length / 1024).toFixed(1)} KB)`);

// ── Step 4: Copy HTML template with cache-busting ───────
console.log("📄 Copying HTML…");
const jsHash = createHash("md5").update(bundle).digest("hex").slice(0, 8);
const cssHash = createHash("md5").update(css).digest("hex").slice(0, 8);
let html = readFileSync(join(FRONTEND, "public", "index.html"), "utf8");
// Add cache-busting query strings
html = html.replace('/static/app.css"', `/static/app.css?v=${cssHash}"`);
html = html.replace('/static/app.js"', `/static/app.js?v=${jsHash}"`);
writeFileSync(join(STATIC, "index.html"), html);
console.log(`  ✓ index.html (cache-bust: js=${jsHash}, css=${cssHash})`);

console.log("\n✅ Build complete → research_agent/static/");

// ── Helpers ─────────────────────────────────────────────

/**
 * Basic TypeScript type stripping for fallback builds.
 * Handles the patterns used in our codebase.
 */
function stripTypes(code) {
  return code
    // Remove `import type` lines
    .replace(/^import\s+type\s+.*$/gm, "")
    // Remove type-only imports from mixed imports
    .replace(/,\s*type\s+\w+/g, "")
    // Remove interface/type declarations (multi-line)
    .replace(/^(export\s+)?(interface|type)\s+\w+[^{]*\{[^}]*\}/gm, "")
    // Remove single-line type aliases
    .replace(/^(export\s+)?type\s+\w+\s*=\s*[^;]+;/gm, "")
    // Remove `: Type` annotations (parameters, variables, returns)
    .replace(/:\s*(?:string|number|boolean|void|null|undefined|any|never|HTMLElement|Element|Event|MouseEvent|KeyboardEvent|DragEvent|SVGElement|SVGGElement|SVGCircleElement|HTMLInputElement|HTMLButtonElement|HTMLSelectElement|HTMLCanvasElement|HTMLDetailsElement|HTMLDivElement|HTMLAnchorElement|HTMLSpanElement|HTMLFormElement|CanvasRenderingContext2D|ReportData|UploadResult|HistoryItem|AgentEventMap|Source|Claim|Command|ParticleMode|ThemeName|AnalyticsData|HeatCell|MapNode|MapEdge|WordEntry|ShortcutGroup|Lang|Translations|DiffLine|CredibilityScore|ClaimNode|ClaimEdge|Bookmark|Notification|NotifPriority|Record<[^>]+>)\s*(?=[,)\]{}=;])/g, "")
    // Remove `: Type[]` annotations
    .replace(/:\s*\w+\[\]\s*(?=[,)\]{}=;])/g, "")
    // Remove `<Type>` generic params on function calls
    .replace(/<(?:string|number|boolean|HTMLElement|HTMLInputElement|HTMLButtonElement|HTMLSelectElement|HTMLAnchorElement|SVGElement|K\s+extends\s+keyof\s+\w+)>/g, "")
    // Remove `as Type` casts
    .replace(/\s+as\s+(?:string|number|boolean|HTML\w+|SVG\w+|Element|any|unknown)\s*/g, " ")
    // Remove function return types
    .replace(/\):\s*(?:string|number|boolean|void|Promise<[^>]+>|HTMLElement|HTMLDivElement|null|Command\[\]|WordEntry\[\]|AnalyticsData|Lang|DiffLine\[\]|CredibilityScore|Bookmark\[\]|ClaimNode\[\]|ClaimEdge\[\])\s*(?=[{])/g, ") ")
    // Remove `!` non-null assertions
    .replace(/!\./g, ".")
    .replace(/!(?=[,);}\]])/g, "");
}
