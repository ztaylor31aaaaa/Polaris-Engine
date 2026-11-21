import test from "node:test";
import assert from "node:assert/strict";
import { analyzeLegacyProject, convertLegacyProject, createMigrationPlan, getMigrationMappings } from "../src/migration/code-migration.js";

test("analyser detects Scramjet and Ultraviolet references without executing source", () => {
  const result = analyzeLegacyProject({
    "src/main.js": 'import { ScramjetController } from "@mercuryworkshop/scramjet";\\nconst controller = new ScramjetController();',
    "src/uv.js": 'importScripts("/uv/uv.bundle.js");\\nconst runtime = Ultraviolet;'
  });
  assert.equal(result.filesScanned, 2);
  assert.ok(result.findings.some(item => item.id === "scramjet-import"));
  assert.ok(result.findings.some(item => item.id === "scramjet-controller"));
  assert.ok(result.findings.some(item => item.id === "ultraviolet-class"));
  assert.ok(result.findings.some(item => item.id === "service-worker-import"));
});

test("converter only applies explicit replacements and preserves untouched files", () => {
  const result = convertLegacyProject({
    "src/main.js": 'const runtime = "old";',
    "README.md": "old"
  }, { replacements: [{ from: '"old"', to: '"new"' }] });
  assert.equal(result.files["src/main.js"], 'const runtime = "new";');
  assert.equal(result.files["README.md"], "old");
  assert.equal(result.changes[0].occurrences, 1);
});

test("converter rejects invalid replacement rules", () => {
  assert.throws(() => convertLegacyProject({ "a.js": "x" }, { replacements: [{ from: "", to: "y" }] }), /non-empty from/);
});

test("migration plan identifies manual transport work", () => {
  const analysis = analyzeLegacyProject({ "src/worker.js": 'importScripts("/bare/worker.js");' });
  const plan = createMigrationPlan(analysis);
  assert.equal(plan.steps.find(step => step.id === "transport").status, "required");
  assert.equal(plan.steps.find(step => step.id === "inventory").status, "done");
});

test("scanner detects legacy HTML script references and ignores non-source files in counts", () => {
  const result = analyzeLegacyProject({
    "index.html": '<script src="/scram/scramjet.all.js"></script>',
    "notes.md": "ScramjetController"
  });
  assert.equal(result.filesScanned, 1);
  assert.ok(result.findings.some(item => item.id === "legacy-script-reference"));
});

test("migration plan includes concrete Polaris API mapping suggestions", () => {
  const analysis = analyzeLegacyProject({ "main.js": "new ScramjetController()" });
  const plan = createMigrationPlan(analysis);
  assert.ok(plan.mappings.some(item => item.polaris.includes("RuntimeManager")));
  assert.ok(getMigrationMappings({ engine: "ultraviolet" }).length > 0);
});
