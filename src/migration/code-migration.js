const LEGACY_PATTERNS = [
  { id: "scramjet-import", engine: "scramjet", severity: "convertible", pattern: /(?:from\s*|import\s*\()(["'][^"']*(?:scramjet|scramjet\.all)[^"']*["'])/gi, message: "Legacy Scramjet module import detected.", suggestion: "Replace the import with the Polaris Engine APIs used by this project." },
  { id: "ultraviolet-import", engine: "ultraviolet", severity: "convertible", pattern: /(?:from\s*|import\s*\()(["'][^"']*(?:ultraviolet|uv\.bundle)[^"']*["'])/gi, message: "Legacy Ultraviolet module import detected.", suggestion: "Replace the import with the Polaris Engine APIs used by this project." },
  { id: "legacy-side-effect-import", engine: "runtime", severity: "convertible", pattern: /\bimport\s*["'][^"']*(?:scramjet|ultraviolet|uv\.bundle|baremux)[^"']*["']/gi, message: "A side-effect import loads a legacy runtime module.", suggestion: "Remove or replace the import after porting the initialisation work it performs." },
  { id: "legacy-url-codec", engine: "runtime", severity: "manual", pattern: /(?:__uv\$|\b(?:scramjet|ultraviolet|uv)\s*\.)?(?:encodeUrl|decodeUrl|rewriteUrl|unrewriteUrl)\b/gi, message: "Legacy URL encoding or rewriting helpers were found.", suggestion: "Replace application-facing URL parsing with native URL and URLSearchParams where appropriate; review old rewritten-URL assumptions individually." },
  { id: "scramjet-controller", engine: "scramjet", severity: "manual", pattern: /\bScramjetController\b/g, message: "ScramjetController usage found.", suggestion: "Replace controller setup with Polaris Engine's runtime, navigation and view adapters." },
  { id: "scramjet-config", engine: "scramjet", severity: "manual", pattern: /\b(?:scramjetConfig|ScramjetConfig)\b|\bscramjet\s*\.\s*config\b/gi, message: "Scramjet configuration references found.", suggestion: "Map each option to Polaris runtime, view, navigation or permission settings; do not copy unknown fields blindly." },
  { id: "scramjet-worker", engine: "scramjet", severity: "manual", pattern: /\bScramjet(?:Service)?Worker\b|scramjet\.(?:sw|worker)\.js/gi, message: "Scramjet worker references found.", suggestion: "Port worker responsibilities separately using WorkerManager and MessageRPC." },
  { id: "ultraviolet-class", engine: "ultraviolet", severity: "manual", pattern: /\bUltraviolet\b|\bUVConfig\b/g, message: "Ultraviolet runtime/configuration usage found.", suggestion: "Map the configuration fields explicitly; there is no universal one-to-one runtime API." },
  { id: "ultraviolet-config", engine: "ultraviolet", severity: "manual", pattern: /__uv\$?config|\bUVServiceWorker\b|\bUVClient\b|\buvConfig\b|\buv\s*\.\s*config\b/gi, message: "Ultraviolet configuration or worker references found.", suggestion: "Map URL handling, worker lifecycle and configuration fields individually to Polaris APIs." },
  { id: "bare-mux", engine: "transport", severity: "manual", pattern: /\bBareMux\b|\bBareClient\b|\bEpoxy\b|\bWisp\b|\bBareServer\b/g, message: "Legacy transport dependency found.", suggestion: "Remove the legacy transport dependency and use an explicitly authorised Polaris transport provider, or native browser APIs." },
  { id: "service-worker-import", engine: "service-worker", severity: "review", pattern: /importScripts\s*\([^)]*(?:scramjet|uv|bare)/gi, message: "Legacy runtime code is imported by a service worker.", suggestion: "Review and replace the worker architecture. Polaris does not silently install a proxy worker." },
  { id: "legacy-script-reference", engine: "runtime", severity: "convertible", pattern: /(?:src|href)\s*=\s*["'][^"']*(?:scramjet|uv\.bundle|baremux)[^"']*["']|["'][^"']*(?:scramjet\.all|uv\.bundle|bare\.client)[^"']*["']/gi, message: "A legacy runtime script or asset reference was found.", suggestion: "Remove the legacy asset reference after porting its application responsibilities to Polaris modules." },
  { id: "global-rewrite", engine: "runtime", severity: "review", pattern: /\b(location\.href|window\.location|fetch\s*\()/g, message: "Direct browser navigation or Fetch usage found.", suggestion: "Review whether native navigation/fetch or a Polaris adapter is appropriate; these calls are not automatically rewritten." },
  { id: "local-storage", engine: "storage", severity: "review", pattern: /\b(?:window\.)?localStorage\.(?:getItem|setItem|removeItem|clear)\b/g, message: "Direct localStorage access found.", suggestion: "Consider WebStorageAdapter for namespaced JSON storage; confirm string-based legacy semantics are not relied upon." },
  { id: "session-storage", engine: "storage", severity: "review", pattern: /\b(?:window\.)?sessionStorage\.(?:getItem|setItem|removeItem|clear)\b/g, message: "Direct sessionStorage access found.", suggestion: "Consider WebStorageAdapter for namespaced session storage; tab snapshots can use SessionPersistence." },
  { id: "indexeddb-access", engine: "storage", severity: "review", pattern: /\bindexedDB\.(?:open|deleteDatabase)\s*\(/g, message: "Direct IndexedDB lifecycle access found.", suggestion: "Consider IndexedDBStore for promise-based object-store operations; existing schemas need an explicit migration." }
];

const asFileMap = files => {
  if (Array.isArray(files)) return Object.fromEntries(files.map(file => [String(file.path), String(file.content ?? "")]));
  if (files && typeof files === "object") return Object.fromEntries(Object.entries(files).map(([path, content]) => [path, String(content ?? "")]));
  throw new TypeError("Project files must be an object map or an array of { path, content }.");
};

/** Scans source files without executing them. */
export function analyzeLegacyProject(files) {
  const fileMap = asFileMap(files);
  const findings = [];
  const supportedFiles = Object.entries(fileMap).filter(([path]) =>
    ["js", "mjs", "cjs", "ts", "tsx", "jsx", "html", "json", "vue", "svelte", "astro"].includes(path.split(".").pop()?.toLowerCase())
  );
  for (const [path, content] of supportedFiles) {
    for (const rule of LEGACY_PATTERNS) {
      rule.pattern.lastIndex = 0;
      const matches = [...content.matchAll(rule.pattern)];
      if (!matches.length) continue;
      findings.push({
        id: rule.id, path, engine: rule.engine, severity: rule.severity,
        occurrences: matches.length,
        lines: [...new Set(matches.map(match => content.slice(0, match.index).split("\n").length))],
        message: rule.message, suggestion: rule.suggestion,
        migration: getFindingMapping(rule.id)
      });
    }
  }
  const engines = [...new Set(findings.map(item => item.engine === "transport" ? "legacy-transport" : item.engine))];
  return {
    schema: 1, filesScanned: supportedFiles.length,
    filesWithFindings: new Set(findings.map(item => item.path)).size,
    detectedEngines: engines, findings,
    summary: {
      convertible: findings.filter(item => item.severity === "convertible").length,
      manual: findings.filter(item => item.severity === "manual").length,
      review: findings.filter(item => item.severity === "review").length
    }
  };
}

/**
 * Applies only explicit, caller-supplied text replacements. This deliberately avoids
 * guessing the semantics of Scramjet/Ultraviolet APIs or rewriting arbitrary application code.
 */
export function convertLegacyProject(files, { replacements = [], include = null } = {}) {
  if (!Array.isArray(replacements)) throw new TypeError("replacements must be an array.");
  if (include !== null && !Array.isArray(include)) throw new TypeError("include must be an array of file paths.");
  const fileMap = asFileMap(files);
  const allowed = include ? new Set(include) : null;
  const convertedFiles = {};
  const changes = [];
  for (const [path, original] of Object.entries(fileMap)) {
    let content = original;
    if (!allowed || allowed.has(path)) {
      for (let index = 0; index < replacements.length; index++) {
        const rule = replacements[index];
        if (!rule || typeof rule.from !== "string" || !rule.from) throw new TypeError("Each replacement requires a non-empty from string.");
        if (typeof rule.to !== "string") throw new TypeError("Each replacement requires a string to value.");
        if (rule.paths !== undefined && (!Array.isArray(rule.paths) || !rule.paths.every(item => typeof item === "string"))) {
          throw new TypeError("Replacement paths must be an array of file paths.");
        }
        if (rule.paths && !rule.paths.includes(path)) continue;
        const count = content.split(rule.from).length - 1;
        if (rule.expectedOccurrences !== undefined && count !== rule.expectedOccurrences) {
          throw new Error("Replacement " + index + " expected " + rule.expectedOccurrences + " occurrence(s) in " + path + " but found " + count + ".");
        }
        if (rule.maxOccurrences !== undefined && (!Number.isInteger(rule.maxOccurrences) || rule.maxOccurrences < 0 || count > rule.maxOccurrences)) {
          throw new Error("Replacement " + index + " exceeded its maxOccurrences limit in " + path + ".");
        }
        if (count) {
          const lineNumbers = [];
          let cursor = 0;
          while ((cursor = content.indexOf(rule.from, cursor)) !== -1) {
            lineNumbers.push(content.slice(0, cursor).split("\n").length);
            cursor += rule.from.length;
          }
          content = content.split(rule.from).join(rule.to);
          changes.push({ path, from: rule.from, to: rule.to, occurrences: count, lineNumbers, replacementIndex: index });
        }
      }
    }
    convertedFiles[path] = content;
  }
  return { files: convertedFiles, changes, analysis: analyzeLegacyProject(convertedFiles) };
}

/** Creates a migration checklist from a scan result; it never runs or evaluates project code. */
export function createMigrationPlan(analysis) {
  if (!analysis || analysis.schema !== 1 || !Array.isArray(analysis.findings)) throw new TypeError("A valid analysis result is required.");
  return {
    schema: 1, sourceEngines: analysis.detectedEngines,
    steps: [
      { id: "inventory", status: "done", title: "Inventory legacy runtime references", detail: `${analysis.filesScanned} files scanned; ${analysis.findings.length} finding groups identified.` },
      { id: "imports", status: analysis.findings.some(item => item.severity === "convertible") ? "required" : "review", title: "Replace legacy imports", detail: "Map each import to an exported Polaris Engine module and verify the replacement API." },
      { id: "runtime", status: analysis.findings.some(item => item.engine === "scramjet" || item.engine === "ultraviolet") ? "required" : "review", title: "Port runtime initialisation", detail: "Replace old controller setup with explicit Polaris runtime, navigation, view and permission configuration." },
      { id: "transport", status: analysis.findings.some(item => item.engine === "transport") ? "required" : "not-applicable", title: "Review transport dependencies", detail: "Use native browser networking or a provider authorised for the deployment. No stealth or policy-evasion layer is supplied." },
      { id: "workers", status: analysis.findings.some(item => item.engine === "service-worker") ? "required" : "review", title: "Review service workers", detail: "Remove old runtime worker imports and validate the replacement worker lifecycle." },
      { id: "verify", status: "required", title: "Run application tests", detail: "Test navigation, storage, messaging, media, workers and error handling in the target browser." }
    ],
    mappings: getMigrationMappings(),
    findings: analysis.findings
  };
}


/** Builds a detailed, reviewable migration report from a static scan. */
export function createMigrationReport(analysis) {
  if (!analysis || analysis.schema !== 1 || !Array.isArray(analysis.findings)) {
    throw new TypeError("A valid analysis result is required.");
  }
  const groups = new Map();
  for (const finding of analysis.findings) {
    const key = finding.id;
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        engine: finding.engine,
        severity: finding.severity,
        message: finding.message,
        suggestion: finding.suggestion,
        migration: finding.migration,
        occurrences: 0,
        locations: []
      });
    }
    const group = groups.get(key);
    group.occurrences += finding.occurrences;
    group.locations.push({
      path: finding.path,
      lines: [...finding.lines],
      occurrences: finding.occurrences
    });
  }
  const findings = [...groups.values()].map(group => ({
    ...group,
    locations: group.locations.sort((a, b) => a.path.localeCompare(b.path))
  }));
  const steps = findings.map((finding, index) => ({
    order: index + 1,
    id: finding.id,
    title: finding.migration?.legacy || finding.message,
    priority: finding.severity === "manual" ? "careful-review" : finding.severity === "convertible" ? "port" : "review",
    confidence: finding.migration?.confidence || "manual",
    affectedFiles: finding.locations.map(location => location.path),
    lineReferences: finding.locations.flatMap(location => location.lines.map(line => ({ path: location.path, line }))),
    recommendedApis: finding.migration?.polaris || [],
    importPath: finding.migration?.importPath || null,
    starterExample: finding.migration?.example || null,
    action: finding.migration?.notes || finding.suggestion,
    verification: "Port this responsibility, then add or update a test that checks its behaviour in the target browser."
  }));
  return {
    schema: 1,
    generatedBy: "Polaris Engine code migration toolkit",
    overview: {
      filesScanned: analysis.filesScanned,
      filesWithFindings: analysis.filesWithFindings,
      findingGroups: findings.length,
      totalOccurrences: findings.reduce((sum, item) => sum + item.occurrences, 0),
      detectedEngines: [...analysis.detectedEngines],
      summary: { ...analysis.summary }
    },
    findings,
    steps
  };
}

/** Renders a detailed report as Markdown for a human-reviewed migration task. */
export function renderMigrationReport(report) {
  if (!report || report.schema !== 1 || !Array.isArray(report.steps) || !report.overview) {
    throw new TypeError("A valid migration report is required.");
  }
  const lines = [
    "# Polaris Engine migration report",
    "",
    "## Overview",
    "",
    "- Files scanned: " + report.overview.filesScanned,
    "- Files with findings: " + report.overview.filesWithFindings,
    "- Finding groups: " + report.overview.findingGroups,
    "- Total occurrences: " + report.overview.totalOccurrences,
    "- Detected components: " + (report.overview.detectedEngines.join(", ") || "None"),
    "",
    "## Recommended migration steps",
    ""
  ];
  if (!report.steps.length) lines.push("No legacy patterns were detected. Review application requirements and run the normal test suite.");
  for (const step of report.steps) {
    lines.push("### " + step.order + ". " + step.title, "");
    lines.push("- Priority: " + step.priority, "- Confidence: " + step.confidence);
    if (step.recommendedApis.length) lines.push("- Polaris APIs: " + step.recommendedApis.map(name => "`" + name + "`").join(", "));
    if (step.importPath) lines.push("- Package: `" + step.importPath + "`");
    lines.push("- Action: " + step.action);
    lines.push("- Verify: " + step.verification);
    if (step.affectedFiles.length) {
      lines.push("- Locations:");
      for (const location of report.findings.find(item => item.id === step.id)?.locations || []) {
        lines.push("  - `" + location.path + "`: line(s) " + location.lines.join(", ") + " (" + location.occurrences + " occurrence(s))");
      }
    }
    if (step.starterExample) {
      lines.push("", "Starter example (adapt and test before use):", "", "```js", step.starterExample, "```");
    }
    lines.push("");
  }
  lines.push("## Safety and compatibility notes", "", "This report is based on static pattern matching, not runtime execution. Recommendations are starting points, not proof of API equivalence. Proxy URL rewriting, proxy transport and legacy proxy workers require a separate, authorised architecture review; this report does not provide network-filter bypass or traffic-concealment code.", "");
  return lines.join("\n");
}

const MIGRATION_MAPPINGS = Object.freeze([
  { id: "scramjet-controller", legacy: "ScramjetController / Ultraviolet runtime startup", confidence: "medium", polaris: ["createLegacyMigrationFacade", "RuntimeManager", "TabRuntime", "TabManager"], importPath: "@polaris/engine", notes: "The lifecycle facade can replace common init/open/navigate/close patterns, but proxy-specific behaviour must be ported separately.", example: 'const controller = createLegacyMigrationFacade({ tabs, views, runtimes });' },
  { id: "legacy-url-codec", legacy: "Scramjet or Ultraviolet URL encoding and rewriting", confidence: "manual", polaris: ["NavigationController", "UrlWatcher", "resolveAddress", "inspectUrl"], importPath: "@polaris/engine", notes: "Native URL tools handle ordinary HTTP(S) addresses only. Rewritten proxy URLs are not equivalent and must be redesigned." },
  { id: "legacy-script-reference", legacy: "Legacy runtime script and asset loading", confidence: "manual", polaris: ["RuntimeManager", "ViewAdapter"], importPath: "@polaris/engine", notes: "Remove obsolete runtime assets only after replacing the application responsibilities they provided." },
  { id: "bare-mux", legacy: "Legacy BareMux / Epoxy transport", confidence: "manual", polaris: ["TransportProviderManager"], importPath: "@polaris/engine", notes: "No automatic transport replacement is proposed. Use native APIs or a provider explicitly authorised for the deployment." },
  { id: "scramjet-worker", legacy: "Legacy runtime worker responsibilities", confidence: "medium", polaris: ["WorkerManager", "MessageRPC"], importPath: "@polaris/engine", notes: "Port independent worker tasks and message contracts; do not copy proxy worker code." },
  { id: "service-worker-import", legacy: "Legacy runtime service worker", confidence: "manual", polaris: ["WorkerManager", "MessageRPC"], importPath: "@polaris/engine", notes: "Review the worker's purpose line by line. These APIs do not replace a proxy service worker." },
  { id: "local-storage", legacy: "Direct localStorage calls", confidence: "medium", polaris: ["WebStorageAdapter"], importPath: "@polaris/engine", example: 'const storage = new WebStorageAdapter({ storage: localStorage, prefix: "my-app:" });', notes: "Adapter stores JSON values under a namespace. getItem/setItem string semantics and shared-key access need deliberate handling." },
  { id: "session-storage", legacy: "Direct sessionStorage calls", confidence: "medium", polaris: ["WebStorageAdapter", "SessionPersistence"], importPath: "@polaris/engine", example: 'const storage = new WebStorageAdapter({ storage: sessionStorage, prefix: "my-app:" });', notes: "Use WebStorageAdapter for namespaced values. SessionPersistence stores tab metadata snapshots, not page state or credentials." },
  { id: "indexeddb-access", legacy: "Direct IndexedDB database lifecycle", confidence: "medium", polaris: ["IndexedDBStore"], importPath: "@polaris/engine", notes: "The wrapper handles object-store operations, but it does not automatically convert an existing schema or database version." },
  { id: "global-rewrite", legacy: "Direct browser navigation and Fetch calls", confidence: "manual", polaris: ["NavigationController", "FetchAdapter"], importPath: "@polaris/engine", notes: "Choose native navigation or FetchAdapter based on actual requirements; no call-site conversion is assumed." },
  { id: "ultraviolet-config", legacy: "Ultraviolet configuration and client APIs", confidence: "manual", polaris: ["SettingsManager", "NavigationController", "ViewAdapter"], importPath: "@polaris/engine", notes: "Map each setting and runtime responsibility individually; there is no universal one-to-one replacement." },
  { id: "scramjet-config", legacy: "Scramjet configuration", confidence: "manual", polaris: ["SettingsManager", "PermissionManager", "ViewAdapter"], importPath: "@polaris/engine", notes: "Map each option explicitly. Do not copy unknown configuration fields." },
  { id: "ultraviolet-import", legacy: "Ultraviolet module imports", confidence: "manual", polaris: ["RuntimeManager", "NavigationController", "ViewAdapter"], importPath: "@polaris/engine", notes: "Select APIs based on what the imported module actually does; an import name alone is insufficient." },
  { id: "scramjet-import", legacy: "Scramjet module imports", confidence: "manual", polaris: ["RuntimeManager", "NavigationController", "ViewAdapter"], importPath: "@polaris/engine", notes: "Select APIs based on what the imported module actually does; an import name alone is insufficient." },
  { id: "legacy-side-effect-import", legacy: "Legacy runtime side-effect imports", confidence: "manual", polaris: ["RuntimeManager"], importPath: "@polaris/engine", notes: "Identify and port each side effect before removing the import." },
  { id: "scramjet-worker", legacy: "Scramjet worker references", confidence: "manual", polaris: ["WorkerManager", "MessageRPC"], importPath: "@polaris/engine", notes: "Worker tasks can be ported separately; do not reuse legacy proxy worker code." },
  { id: "ultraviolet-class", legacy: "Ultraviolet runtime class", confidence: "manual", polaris: ["RuntimeManager", "TabRuntime"], importPath: "@polaris/engine", notes: "Identify runtime responsibilities before choosing Polaris lifecycle APIs." }
]);

function getFindingMapping(id) {
  const mapping = MIGRATION_MAPPINGS.find(item => item.id === id);
  if (!mapping) return null;
  const { id: _id, ...publicMapping } = mapping;
  return { ...publicMapping, polaris: [...mapping.polaris] };
}

export function getMigrationMappings({ engine = "all", confidence = "all" } = {}) {
  const mappings = MIGRATION_MAPPINGS.filter(item =>
    (engine === "all" || item.legacy.toLowerCase().includes(String(engine).toLowerCase())) &&
    (confidence === "all" || item.confidence === confidence)
  );
  return mappings.map(({ id, ...item }) => ({ ...item, polaris: [...item.polaris] }));
}
