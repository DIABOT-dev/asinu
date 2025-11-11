#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const srcDir = path.join(repoRoot, "src");

const transitionalSupabaseAllowlist = new Set();

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

  const hasBolt = /bolt/i.test(content);
  if (hasBolt) {
    violations.push({ file: relativePath, term: "bolt" });
  }

  const hasSupabase = /supabase/i.test(content);
  if (hasSupabase && !transitionalSupabaseAllowlist.has(relativePath)) {
    violations.push({ file: relativePath, term: "supabase" });
  }
}

await walk(srcDir);

if (violations.length > 0) {
  console.error("\n🚫 No-Bolt QA gate failed. Remove legacy Bolt/Supabase references:");
  for (const { file, term } of violations) {
    console.error(`  - ${file} → contains disallowed term: ${term}`);
  }
  console.error("\nUpdate docs/tech/MIGRATION_FROM_BOLT.md if additional exceptions are required.");
  process.exit(1);
}

console.log("✅ No-Bolt QA gate passed — no unauthorized Bolt/Supabase references in src/**");
