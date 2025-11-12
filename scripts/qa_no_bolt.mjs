#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const srcDir = path.join(repoRoot, "src");

const forbiddenTermsEnv = process.env.QA_FORBIDDEN_TERMS ?? "bolt";
const forbiddenTerms = forbiddenTermsEnv
  .split(",")
  .map((term) => term.trim())
  .filter(Boolean);
const transitionalAllowlist = new Set(
  (process.env.QA_FORBIDDEN_ALLOWLIST ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
);

const violations = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
    } else if (entry.isFile()) {
      await inspectFile(fullPath);
    }
  }
}

async function inspectFile(filePath) {
  const content = await readFile(filePath, "utf8");
  const relativePath = path.relative(repoRoot, filePath).split(path.sep).join("/");

  for (const term of forbiddenTerms) {
    const regex = new RegExp(term, "i");
    if (regex.test(content) && !transitionalAllowlist.has(relativePath)) {
      violations.push({ file: relativePath, term });
    }
  }
}

await walk(srcDir);

if (violations.length > 0) {
  console.error("\n🚫 No-Bolt QA gate failed. Remove legacy references:");
  for (const { file, term } of violations) {
    console.error(`  - ${file} → contains disallowed term: ${term}`);
  }
  console.error("\nUpdate docs/tech/MIGRATION_FROM_BOLT.md if additional exceptions are required.");
  process.exit(1);
}

console.log("✅ No-Bolt QA gate passed — no unauthorized forbidden terms in src/**");
