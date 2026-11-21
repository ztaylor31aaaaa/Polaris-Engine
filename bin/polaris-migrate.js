#!/usr/bin/env node
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { analyzeLegacyProject, createMigrationReport, renderMigrationReport } from "../src/migration/code-migration.js";

const args = process.argv.slice(2);
const outputFlag = args.indexOf("--out");
const formatFlag = args.indexOf("--format");
const positional = args.filter((arg, index) =>
  !arg.startsWith("--") &&
  (outputFlag < 0 || index !== outputFlag + 1) &&
  (formatFlag < 0 || index !== formatFlag + 1)
);
const root = path.resolve(positional[0] || ".");
const format = formatFlag >= 0 ? args[formatFlag + 1] : "json";
if (!["json", "markdown", "md"].includes(format)) throw new Error("Format must be json or markdown.");
const outputPath = outputFlag >= 0
  ? path.resolve(args[outputFlag + 1] || (format === "json" ? "polaris-migration-plan.json" : "polaris-migration-report.md"))
  : null;
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
  const report = createMigrationReport(analysis);
  const output = format === "json" ? JSON.stringify(report, null, 2) : renderMigrationReport(report);
  console.log(output);
  if (outputPath) {
    await writeFile(outputPath, output + "\n", "utf8");
    console.error("Migration report saved to " + outputPath);
  }
  if (analysis.findings.length) process.exitCode = 2;
} catch (error) {
  console.error("Polaris migration scan failed: " + error.message);
  process.exitCode = 1;
}
