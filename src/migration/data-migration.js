const WEB = new Set(["http:", "https:"]);
const PREFERENCE_KEYS = new Set(["theme", "reduceMotion", "reducedMotion", "restoreSession", "restoreTabs", "confirmCloseMultipleTabs", "confirmClose", "zoom", "language", "homepage", "searchTemplate", "showFullUrls", "compactMode", "showClock", "density", "corners", "customScrollbar"]);
const text = (value, max = 160) => String(value ?? "").slice(0, max);
function safeUrl(value) {
  try { const url = new URL(value); return WEB.has(url.protocol) ? url.href : null; } catch { return null; }
}
function bookmarkRows(input) {
  if (!Array.isArray(input)) return [];
  return input.map(item => {
    if (typeof item === "string") return { url: safeUrl(item), title: text(item) };
    const url = safeUrl(item?.url || item?.href || item?.uri);
    return url ? { url, title: text(item.title || item.name || url), folder: text(item.folder || item.parent || "Imported", 60) } : null;
  }).filter(Boolean);
}
function historyRows(input) {
  if (!Array.isArray(input)) return [];
  return input.map(item => {
    const url = safeUrl(typeof item === "string" ? item : item?.url || item?.href);
    return url ? { url, title: text(item?.title || item?.name || url), visitedAt: item?.visitedAt || item?.lastVisitTime || null } : null;
  }).filter(Boolean);
}
function tabRows(input) {
  if (!Array.isArray(input)) return [];
  return input.map(item => {
    const url = safeUrl(item?.url || item?.href || "");
    return { title: text(item?.title || item?.name || url || "Imported tab", 120), url: url || "", pinned: Boolean(item?.pinned), group: text(item?.group || "", 40) };
  }).filter(item => item.url || item.title);
}
function flattenBookmarksTree(nodes, output = []) {
  for (const node of nodes || []) {
    if (node.url) output.push({ url: node.url, title: node.name || node.title, folder: "Imported" });
    if (Array.isArray(node.children)) flattenBookmarksTree(node.children, output);
  }
  return output;
}

/**
 * Normalises user-owned browser data from JSON exports. Scramjet and Ultraviolet
 * are runtimes, not standardised browser-data formats, so callers must supply
 * an export from the host browser/app or a common bookmarks JSON export.
 */
export function inspectMigration(input, { source = "auto" } = {}) {
  let data = input;
  if (typeof input === "string") {
    try { data = JSON.parse(input); }
    catch { throw new TypeError("Import must be valid JSON. Export bookmarks as JSON first."); }
  }
  if (!data || typeof data !== "object") throw new TypeError("Unsupported import file.");
  const root = data.roots ? flattenBookmarksTree(Object.values(data.roots)) : [];
  const bookmarks = bookmarkRows(data.bookmarks || data.favorites || data.bookmarkList || root);
  const history = historyRows(data.history || data.visits || data.historyItems);
  const tabs = tabRows(data.tabs || data.session?.tabs || data.openTabs);
  const rawSettings = data.settings && typeof data.settings === "object" ? data.settings : {};
  const settings = {};
  for (const key of ["theme", "reduceMotion", "restoreSession", "confirmCloseMultipleTabs", "zoom", "language", "homepage", "searchTemplate"]) {
    if (Object.hasOwn(rawSettings, key)) settings[key] = rawSettings[key];
  }
  const detected = source !== "auto" ? source :
    /ultraviolet|uv-/i.test(String(data.source || data.app || data.format || "")) ? "ultraviolet" :
    /scramjet|sj-/i.test(String(data.source || data.app || data.format || "")) ? "scramjet" : "generic";
  return {
    schema: 1, source: detected,
    counts: { bookmarks: bookmarks.length, history: history.length, tabs: tabs.length, settings: Object.keys(settings).length },
    data: { bookmarks, history, tabs, settings }
  };
}
export function applyMigration(preview, { bookmarks = [], history = [], tabs = [], settings = {}, mode = "merge" } = {}) {
  if (!preview || preview.schema !== 1 || !preview.data) throw new TypeError("Invalid migration preview.");
  if (!["merge", "replace"].includes(mode)) throw new TypeError("Migration mode must be merge or replace.");
  const incoming = preview.data;
  const combine = (current, added, key) => {
    const base = mode === "replace" ? [] : current;
    const seen = new Set(base.map(item => item[key]));
    return [...base, ...added.filter(item => !seen.has(item[key]))];
  };
  return {
    bookmarks: combine(bookmarks, incoming.bookmarks, "url"),
    history: combine(history, incoming.history, "url").slice(0, 500),
    tabs: (mode === "replace" ? incoming.tabs : [...tabs, ...incoming.tabs]).slice(0, 40),
    settings: mode === "replace" ? { ...incoming.settings } : { ...settings, ...incoming.settings }
  };
}
export function exportPortableData({ bookmarks = [], history = [], tabs = [], settings = {} } = {}) {
  return {
    app: "Polaris", format: "polaris-portable-data", schema: 1, exportedAt: new Date().toISOString(),
    bookmarks: bookmarkRows(bookmarks), history: historyRows(history), tabs: tabRows(tabs),
    settings: Object.fromEntries(Object.entries(settings).filter(([key, value]) => PREFERENCE_KEYS.has(key) && ["string", "boolean", "number"].includes(typeof value)))
  };
}
