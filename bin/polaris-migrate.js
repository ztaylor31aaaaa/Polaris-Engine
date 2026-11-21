#!/usr/bin/env node
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { analyzeLegacyProject, createMigrationPlan } from "../src/migration/code-migration.js";

const args = process.argv.slice(2);
const outputFlag = args.indexOf("--out");
const positional = args.filter((arg, index) => !arg.startsWith("--") && index !== outputFlag + 1);
const root = path.resolve(positional[0] || ".");
const outputPath = outputFlag >= 0 ? path.resolve(args[outputFlag + 1] || "polaris-migration-plan.json") : null;
const extensions = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".html", ".json"]);
const ignored = new Set(["node_modules", ".git", "dist", "build", ".next", ".cache"]);
const sourceFiles = {};
let totalBytes = 0;
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink() || ignored.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(fullPath);
    else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) {
      const buffer = await readFile(fullPath);
      totalBytes += buffer.byteLength;
      if (totalBytes > 50 * 1024 * 1024) throw new Error("Project scan exceeds the 50 MB text limit.");
      sourceFiles[path.relative(root, fullPath).split(path.sep).join("/")] = buffer.toString("utf8");
    }
  }
}
try {
  await walk(root);
  const analysis = analyzeLegacyProject(sourceFiles);
  const plan = createMigrationPlan(analysis);
  const report = { ...plan, filesScanned: analysis.filesScanned, filesWithFindings: analysis.filesWithFindings, summary: analysis.summary };
  console.log(JSON.stringify(report, null, 2));
  if (outputPath) {
    await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n", "utf8");
    console.error("Migration plan saved to " + outputPath);
  }
  if (analysis.findings.length) process.exitCode = 2;
} catch (error) {
  console.error("Polaris migration scan failed: " + error.message);
  process.exitCode = 1;
}
