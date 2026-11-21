const LEGACY_PATTERNS = [
  { id: "scramjet-import", engine: "scramjet", severity: "convertible", pattern: /(?:from\s*|import\s*\()(["'][^"']*(?:scramjet|scramjet\.all)[^"']*["'])/gi, message: "Legacy Scramjet module import detected.", suggestion: "Replace the import with the Polaris Engine APIs used by this project." },
  { id: "ultraviolet-import", engine: "ultraviolet", severity: "convertible", pattern: /(?:from\s*|import\s*\()(["'][^"']*(?:ultraviolet|uv\.bundle)[^"']*["'])/gi, message: "Legacy Ultraviolet module import detected.", suggestion: "Replace the import with the Polaris Engine APIs used by this project." },
  { id: "scramjet-controller", engine: "scramjet", severity: "manual", pattern: /\bScramjetController\b/g, message: "ScramjetController usage found.", suggestion: "Replace controller setup with Polaris Engine's runtime, navigation and view adapters." },
  { id: "scramjet-config", engine: "scramjet", severity: "manual", pattern: /\b(?:scramjetConfig|ScramjetConfig)\b|\bscramjet\s*\.\s*config\b/gi, message: "Scramjet configuration references found.", suggestion: "Map each option to Polaris runtime, view, navigation or permission settings; do not copy unknown fields blindly." },
  { id: "scramjet-worker", engine: "scramjet", severity: "manual", pattern: /\bScramjet(?:Service)?Worker\b|scramjet\.(?:sw|worker)\.js/gi, message: "Scramjet worker references found.", suggestion: "Port worker responsibilities separately using WorkerManager and MessageRPC." },
  { id: "ultraviolet-class", engine: "ultraviolet", severity: "manual", pattern: /\bUltraviolet\b|\bUVConfig\b/g, message: "Ultraviolet runtime/configuration usage found.", suggestion: "Map the configuration fields explicitly; there is no universal one-to-one runtime API." },
  { id: "ultraviolet-config", engine: "ultraviolet", severity: "manual", pattern: /__uv\$?config|\bUVServiceWorker\b|\bUVClient\b|\buvConfig\b|\buv\s*\.\s*config\b/gi, message: "Ultraviolet configuration or worker references found.", suggestion: "Map URL handling, worker lifecycle and configuration fields individually to Polaris APIs." },
  { id: "bare-mux", engine: "transport", severity: "manual", pattern: /\bBareMux\b|\bBareClient\b|\bEpoxy\b|\bWisp\b|\bBareServer\b/g, message: "Legacy transport dependency found.", suggestion: "Remove the legacy transport dependency and use an explicitly authorised Polaris transport provider, or native browser APIs." },
  { id: "service-worker-import", engine: "service-worker", severity: "review", pattern: /importScripts\s*\([^)]*(?:scramjet|uv|bare)/gi, message: "Legacy runtime code is imported by a service worker.", suggestion: "Review and replace the worker architecture. Polaris does not silently install a proxy worker." },
  { id: "legacy-script-reference", engine: "runtime", severity: "convertible", pattern: /(?:src|href)\s*=\s*["'][^"']*(?:scramjet|uv\.bundle|baremux)[^"']*["']|["'][^"']*(?:scramjet\.all|uv\.bundle|bare\.client)[^"']*["']/gi, message: "A legacy runtime script or asset reference was found.", suggestion: "Remove the legacy asset reference after porting its application responsibilities to Polaris modules." },
  { id: "global-rewrite", engine: "runtime", severity: "review", pattern: /\b(location\.href|window\.location|fetch\s*\()/g, message: "Direct browser navigation or Fetch usage found.", suggestion: "Review whether native navigation/fetch or a Polaris adapter is appropriate; these calls are not automatically rewritten." }
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
        message: rule.message, suggestion: rule.suggestion
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

const MIGRATION_MAPPINGS = Object.freeze([
  { legacy: "ScramjetController / Ultraviolet runtime startup", polaris: ["RuntimeManager", "TabRuntime", "TabManager"], notes: "Rebuild startup and disposal around explicit Polaris runtime lifecycle." },
  { legacy: "Scramjet or Ultraviolet URL handling", polaris: ["NavigationController", "UrlWatcher", "resolveAddress"], notes: "Use native HTTP(S) URL handling; do not assume old URL rewriting semantics are interchangeable." },
  { legacy: "Legacy proxied iframe/view lifecycle", polaris: ["ViewAdapter", "FrameController"], notes: "Review sandbox flags, origin checks and messaging. Polaris does not rewrite network traffic." },
  { legacy: "Legacy BareMux / Epoxy transport", polaris: ["TransportProviderManager"], notes: "Only register a provider authorised for the deployment; native Fetch/WebSocket are separate browser APIs." },
  { legacy: "Legacy runtime service worker", polaris: ["WorkerManager", "MessageRPC"], notes: "Port worker tasks and messaging independently; do not carry over proxy worker code." },
  { legacy: "Runtime browser API feature checks", polaris: ["createFeatureProfile", "createBrowserSurface"], notes: "Gate optional APIs by feature detection and provide application-level fallbacks." }
]);

export function getMigrationMappings({ engine = "all" } = {}) {
  const mappings = MIGRATION_MAPPINGS.filter(item => engine === "all" || item.legacy.toLowerCase().includes(String(engine).toLowerCase()));
  return mappings.map(item => ({ ...item, polaris: [...item.polaris] }));
}
