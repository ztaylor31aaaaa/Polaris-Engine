const checks = [
  ["JavaScript modules", () => true, "ES modules are available."],
  ["Fetch API", () => typeof globalThis.fetch === "function", "Native fetch capability; no request is sent."],
  ["URL API", () => typeof globalThis.URL === "function", "URL parsing is available."],
  ["Local storage", () => { try { return Boolean(globalThis.localStorage); } catch { return false; } }, "Storage availability depends on browser permissions."],
  ["Session storage", () => { try { return Boolean(globalThis.sessionStorage); } catch { return false; } }, "Session storage capability."],
  ["Service workers", () => Boolean(globalThis.navigator?.serviceWorker), "Capability only; no worker is registered."],
  ["WebSocket API", () => typeof globalThis.WebSocket === "function", "Capability only; no connection is attempted."],
  ["Web Workers", () => typeof globalThis.Worker === "function", "Native dedicated worker support."],
  ["Shared Workers", () => typeof globalThis.SharedWorker === "function", "Native shared worker support."],
  ["MessageChannel", () => typeof globalThis.MessageChannel === "function", "MessagePort communication support."],
  ["BroadcastChannel", () => typeof globalThis.BroadcastChannel === "function", "Cross-context messaging support."],
  ["IndexedDB", () => Boolean(globalThis.indexedDB), "Structured browser database capability."],
  ["Cache Storage", () => Boolean(globalThis.caches?.open), "Cache API capability; no cache is opened."],
  ["MutationObserver", () => typeof globalThis.MutationObserver === "function", "DOM mutation observation."],
  ["IntersectionObserver", () => typeof globalThis.IntersectionObserver === "function", "Viewport intersection observation."],
  ["ResizeObserver", () => typeof globalThis.ResizeObserver === "function", "Element resize observation."],
  ["PerformanceObserver", () => typeof globalThis.PerformanceObserver === "function", "Performance entry observation."],
  ["Web Crypto", () => Boolean(globalThis.crypto?.subtle), "Cryptographic API capability."],
  ["Readable Streams", () => typeof globalThis.ReadableStream === "function", "Streaming response/body support."],
  ["Transform Streams", () => typeof globalThis.TransformStream === "function", "Streaming transform support."],
  ["Compression Streams", () => typeof globalThis.CompressionStream === "function", "Native compression stream support."],
  ["WebAssembly", () => Boolean(globalThis.WebAssembly), "WebAssembly runtime capability."],
  ["OffscreenCanvas", () => typeof globalThis.OffscreenCanvas === "function", "Offscreen rendering capability."],
  ["History API", () => Boolean(globalThis.history?.pushState), "Client-side history API capability."],
  ["Broadcast / messaging primitives", () => typeof globalThis.MessageEvent === "function", "Standard message event support."]
];

export async function runDiagnostics() {
  const results = checks.map(([name, check, detail]) => {
    let available = false;
    try { available = Boolean(check()); } catch {}
    return { name, status: available ? "pass" : "warn", detail };
  });
  const critical = new Set(["JavaScript modules", "Fetch API", "URL API"]);
  const criticalHealthy = results.filter(item => critical.has(item.name)).every(item => item.status === "pass");
  return {
    checkedAt: new Date().toISOString(),
    checks: results,
    healthy: results.every(item => item.status === "pass"),
    criticalHealthy,
    summary: { total: results.length, passed: results.filter(x => x.status === "pass").length, warnings: results.filter(x => x.status === "warn").length }
  };
}
