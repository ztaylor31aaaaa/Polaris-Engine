const API_NAMES = [
  "fetch", "URL", "URLSearchParams", "AbortController", "ReadableStream", "WritableStream",
  "TransformStream", "TextEncoder", "TextDecoder", "Blob", "File", "FormData", "Headers",
  "Request", "Response", "Worker", "SharedWorker", "MessageChannel", "BroadcastChannel",
  "MutationObserver", "IntersectionObserver", "ResizeObserver", "PerformanceObserver",
  "indexedDB", "caches", "serviceWorker", "WebSocket", "WebTransport", "WebCrypto",
  "OffscreenCanvas", "WebAssembly", "WebGL2", "WebGPU", "CompressionStream", "DecompressionStream"
];
export function detectPlatform(scope = globalThis) {
  const checks = API_NAMES.map(name => {
    let available = false;
    try {
      if (name === "serviceWorker") available = Boolean(scope.navigator?.serviceWorker);
      else if (name === "WebCrypto") available = Boolean(scope.crypto?.subtle);
      else if (name === "WebGL2") available = Boolean(scope.document?.createElement("canvas").getContext("webgl2"));
      else if (name === "WebGPU") available = Boolean(scope.navigator?.gpu);
      else available = name in scope && scope[name] != null;
    } catch {}
    return { name, available };
  });
  const available = checks.filter(item => item.available).map(item => item.name);
  const missing = checks.filter(item => !item.available).map(item => item.name);
  return Object.freeze({ checks, available, missing, count: checks.length, supported: available.length });
}
export function requirePlatformFeatures(features, scope = globalThis) {
  const report = detectPlatform(scope);
  const missing = features.filter(name => !report.available.includes(name));
  if (missing.length) throw new Error("Missing browser features: " + missing.join(", "));
  return true;
}
