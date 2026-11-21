import test from "node:test";
import assert from "node:assert/strict";
import { analyzeLegacyProject, convertLegacyProject, createMigrationPlan, createMigrationReport, renderMigrationReport, getMigrationMappings } from "../src/migration/code-migration.js";

test("analyser detects Scramjet and Ultraviolet references without executing source", () => {
  const result = analyzeLegacyProject({
    "src/main.js": 'import { ScramjetController } from "@mercuryworkshop/scramjet";\nconst controller = new ScramjetController();',
    "src/uv.js": 'importScripts("/uv/uv.bundle.js");\nconst runtime = Ultraviolet;'
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
  const analysis = analyzeLegacyProject({ "src/worker.js": 'import { BareMux } from "@bare-mux/bridge";' });
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

test("scanner recognises legacy config and worker APIs", () => {
  const result = analyzeLegacyProject({
    "config.js": 'const scramjetConfig = {}; const uvConfig = {};',
    "worker.js": 'new ScramjetServiceWorker(); new UVServiceWorker(); new BareServer();'
  });
  assert.ok(result.findings.some(item => item.id === "scramjet-config"));
  assert.ok(result.findings.some(item => item.id === "ultraviolet-config"));
  assert.ok(result.findings.some(item => item.id === "scramjet-worker"));
  assert.ok(result.findings.some(item => item.id === "bare-mux"));
});

test("converter reports exact changed lines and supports per-file limits", () => {
  const result = convertLegacyProject({
    "src/a.js": 'old\nconst value = "old";',
    "src/b.js": "old"
  }, {
    replacements: [{ from: "old", to: "new", paths: ["src/a.js"], expectedOccurrences: 2, maxOccurrences: 2 }]
  });
  assert.deepEqual(result.changes[0].lineNumbers, [1, 2]);
  assert.equal(result.files["src/a.js"], 'new\nconst value = "new";');
  assert.equal(result.files["src/b.js"], "old");
});

test("converter refuses unexpected occurrence counts before accepting a codemod", () => {
  assert.throws(() => convertLegacyProject({ "a.js": "old old" }, {
    replacements: [{ from: "old", to: "new", expectedOccurrences: 1 }]
  }), /expected 1 occurrence/);
});

test("scanner includes common component source files", () => {
  const result = analyzeLegacyProject({
    "App.vue": 'new ScramjetController()',
    "Widget.svelte": 'const uvConfig = {};',
    "page.astro": 'new UVServiceWorker()'
  });
  assert.equal(result.filesScanned, 3);
  assert.ok(result.findings.length >= 3);
});

test("scanner detects side-effect runtime imports and legacy URL helper calls", () => {
  const result = analyzeLegacyProject({
    "main.js": 'import "@mercuryworkshop/scramjet";\nconst url = __uv$encodeUrl(input);'
  });
  assert.ok(result.findings.some(item => item.id === "legacy-side-effect-import"));
  assert.ok(result.findings.some(item => item.id === "legacy-url-codec"));
});

test("scanner detects side-effect imports and legacy URL helper calls", () => {
  const result = analyzeLegacyProject({
    "main.js": 'import "@mercuryworkshop/scramjet";\nconst url = __uv$encodeUrl(input);'
  });
  assert.ok(result.findings.some(item => item.id === "legacy-side-effect-import"));
  assert.ok(result.findings.some(item => item.id === "legacy-url-codec"));
});

test("scanner attaches confidence-ranked storage migration recommendations", () => {
  const result = analyzeLegacyProject({
    "src/storage.js": 'localStorage.setItem("theme", "dark"); sessionStorage.getItem("tab"); indexedDB.open("app");'
  });
  const byId = Object.fromEntries(result.findings.map(item => [item.id, item]));
  assert.equal(byId["local-storage"].migration.confidence, "medium");
  assert.deepEqual(byId["local-storage"].migration.polaris, ["WebStorageAdapter"]);
  assert.ok(byId["session-storage"].migration.polaris.includes("SessionPersistence"));
  assert.ok(byId["indexeddb-access"].migration.polaris.includes("IndexedDBStore"));
});

test("proxy transport and URL rewriting findings stay manual-review mappings", () => {
  const result = analyzeLegacyProject({
    "src/runtime.js": 'new BareMux(); const u = __uv$encodeUrl(input);'
  });
  const transport = result.findings.find(item => item.id === "bare-mux");
  const url = result.findings.find(item => item.id === "legacy-url-codec");
  assert.equal(transport.migration.confidence, "manual");
  assert.equal(url.migration.confidence, "manual");
  assert.match(transport.migration.notes, /authorised/);
});

test("migration mappings can be filtered by confidence", () => {
  const medium = getMigrationMappings({ confidence: "medium" });
  assert.ok(medium.length > 0);
  assert.ok(medium.every(item => item.confidence === "medium"));
  assert.ok(getMigrationMappings({ engine: "ultraviolet", confidence: "manual" }).length > 0);
});


test("detailed migration report groups locations and produces ordered steps", () => {
  const analysis = analyzeLegacyProject({
    "src/a.js": 'localStorage.setItem("theme", "dark");\\nlocalStorage.getItem("theme");',
    "src/b.js": 'new ScramjetController();'
  });
  const report = createMigrationReport(analysis);
  assert.equal(report.overview.filesScanned, 2);
  assert.ok(report.overview.totalOccurrences >= 3);
  const storage = report.findings.find(item => item.id === "local-storage");
  assert.equal(storage.occurrences, 2);
  assert.deepEqual(storage.locations[0].lines, [1, 2]);
  const storageStep = report.steps.find(item => item.id === "local-storage");
  assert.equal(storageStep.confidence, "medium");
  assert.ok(storageStep.starterExample.includes("WebStorageAdapter"));
  assert.ok(report.steps.every((step, index) => step.order === index + 1));
});

test("Markdown migration report includes locations, code examples and review warnings", () => {
  const analysis = analyzeLegacyProject({
    "src/proxy.js": 'new BareMux();',
    "src/storage.js": 'localStorage.setItem("mode", "dark");'
  });
  const markdown = renderMigrationReport(createMigrationReport(analysis));
  assert.match(markdown, /Polaris Engine migration report/);
  assert.match(markdown, /src\\/proxy\\.js/);
  assert.match(markdown, /WebStorageAdapter/);
  assert.match(markdown, /network-filter bypass/);
});

test("detailed report rejects invalid analysis and renderer input", () => {
  assert.throws(() => createMigrationReport({ schema: 2, findings: [] }), /valid analysis/);
  assert.throws(() => renderMigrationReport({ schema: 1 }), /valid migration report/);
});
