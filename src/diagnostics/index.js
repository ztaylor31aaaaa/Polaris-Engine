export async function runDiagnostics() {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, status: ok ? "pass" : "warn", detail });
  add("JavaScript modules", true, "ES modules are available.");
  add("Fetch API", typeof fetch === "function", typeof fetch === "function" ? "Fetch is available." : "Fetch is unavailable.");
  add("URL API", typeof URL === "function", typeof URL === "function" ? "URL parsing is available." : "URL parsing is unavailable.");
  add("Storage", (() => { try { return typeof localStorage !== "undefined"; } catch { return false; } })(), "Storage availability depends on browser permissions.");
  add("Service workers", typeof navigator !== "undefined" && "serviceWorker" in navigator, "Availability does not imply permission to register a worker.");
  add("WebSocket API", typeof WebSocket === "function", "Reports browser API availability only; it does not test or connect to a server.");
  return { checkedAt: new Date().toISOString(), checks, healthy: checks.every(item => item.status === "pass") };
}
