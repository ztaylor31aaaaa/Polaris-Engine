const CATALOG = Object.freeze([
  ["fetch", "network", ["fetch"]], ["Request", "network", ["Request"]], ["Response", "network", ["Response"]], ["Headers", "network", ["Headers"]],
  ["WebSocket", "network", ["WebSocket"]], ["EventSource", "network", ["EventSource"]],
  ["URL", "url", ["URL"]], ["URLSearchParams", "url", ["URLSearchParams"]],
  ["History", "navigation", ["history"]], ["Location", "navigation", ["location"]],
  ["localStorage", "storage", ["localStorage"]], ["sessionStorage", "storage", ["sessionStorage"]],
  ["indexedDB", "storage", ["indexedDB"]], ["caches", "storage", ["caches"]],
  ["serviceWorker", "workers", ["navigator", "serviceWorker"]], ["Worker", "workers", ["Worker"]], ["SharedWorker", "workers", ["SharedWorker"]],
  ["MessageChannel", "messaging", ["MessageChannel"]], ["BroadcastChannel", "messaging", ["BroadcastChannel"]],
  ["ReadableStream", "streams", ["ReadableStream"]], ["WritableStream", "streams", ["WritableStream"]], ["TransformStream", "streams", ["TransformStream"]],
  ["TextEncoder", "encoding", ["TextEncoder"]], ["TextDecoder", "encoding", ["TextDecoder"]],
  ["CompressionStream", "compression", ["CompressionStream"]], ["DecompressionStream", "compression", ["DecompressionStream"]],
  ["crypto", "security", ["crypto"]], ["SubtleCrypto", "security", ["crypto", "subtle"]],
  ["MutationObserver", "dom", ["MutationObserver"]], ["IntersectionObserver", "dom", ["IntersectionObserver"]], ["ResizeObserver", "dom", ["ResizeObserver"]],
  ["PerformanceObserver", "performance", ["PerformanceObserver"]], ["Performance", "performance", ["performance"]],
  ["DOMParser", "dom", ["DOMParser"]], ["Blob", "files", ["Blob"]], ["File", "files", ["File"]], ["FormData", "files", ["FormData"]],
  ["WebAssembly", "compute", ["WebAssembly"]], ["OffscreenCanvas", "graphics", ["OffscreenCanvas"]]
]);
function readPath(root, path) {
  try { let value = root; for (const key of path) { if (value == null) return undefined; value = value[key]; } return value; }
  catch { return undefined; }
}
export class CompatibilityError extends Error {
  constructor(missing) {
    super("Required browser features are unavailable: " + missing.join(", "));
    this.name = "CompatibilityError";
    this.code = "POLARIS_FEATURES_MISSING";
    this.missing = [...missing];
  }
}
/** Reports native browser APIs without patching globals or pretending missing APIs exist. */
export function createFeatureProfile({ globalObject = globalThis } = {}) {
  const features = CATALOG.map(([name, group, path]) => {
    const value = readPath(globalObject, path);
    return Object.freeze({ name, group, available: value !== undefined && value !== null, native: value !== undefined && value !== null });
  });
  const available = features.filter(item => item.available).map(item => item.name);
  const missing = features.filter(item => !item.available).map(item => item.name);
  return Object.freeze({
    features: Object.freeze(features),
    available: Object.freeze(available),
    missing: Object.freeze(missing),
    supports(name) { return available.includes(name); },
    require(names) {
      const absent = names.filter(name => !available.includes(name));
      if (absent.length) throw new CompatibilityError(absent);
      return true;
    }
  });
}
/** Returns an explicit namespace of available native APIs; it does not monkey-patch window. */
export function createBrowserSurface({ globalObject = globalThis, profile = createFeatureProfile({ globalObject }) } = {}) {
  const surface = {};
  for (const [name, , path] of CATALOG) {
    if (profile.supports(name)) surface[name] = readPath(globalObject, path);
  }
  surface.features = profile;
  return Object.freeze(surface);
}
