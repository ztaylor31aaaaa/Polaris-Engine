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
function flattenBookmarksTree(nodes, output = [], path = []) {
  for (const node of nodes || []) {
    const nextPath = node.children ? [...path, text(node.name || node.title || "Folder", 60)] : path;
    if (node.url) output.push({ url: node.url, title: node.name || node.title, folder: path.join("/") || "Imported" });
    if (Array.isArray(node.children)) flattenBookmarksTree(node.children, output, nextPath);
  }
  return output;
}
function decodeHtml(value) {
  const entities = { "&amp;": "&", "&quot;": "\"", "&#39;": "'", "&apos;": "'", "&lt;": "<", "&gt;": ">" };
  return String(value).replace(/&(amp|quot|#39|apos|lt|gt);/gi, entity => entities[entity.toLowerCase()] || entity);
}
function parseBookmarkHtml(input) {
  const rows = [];
  const folders = [];
  let pendingFolder = null;
  const tokens = String(input).match(/<\\/?(?:DL|DT)\\b[^>]*>|<H3\\b[^>]*>[\\s\\S]*?<\\/H3>|<A\\b[^>]*?href\\s*=\\s*(["'])(.*?)\\1[^>]*>[\\s\\S]*?<\\/A>/gi) || [];
  for (const token of tokens) {
    if (/^<H3\\b/i.test(token)) {
      pendingFolder = decodeHtml(token.replace(/<[^>]*>/g, "").trim()).slice(0, 60) || "Folder";
    } else if (/^<DL\\b/i.test(token)) {
      if (pendingFolder) folders.push(pendingFolder);
      pendingFolder = null;
    } else if (/^<\\/DL/i.test(token)) {
      if (folders.length) folders.pop();
      pendingFolder = null;
    } else if (/^<A\\b/i.test(token)) {
      const match = token.match(/href\\s*=\\s*(["'])(.*?)\\1/i);
      if (!match) continue;
      const url = decodeHtml(match[2]);
      const title = decodeHtml(token.replace(/^<[A]+\\b[^>]*>/i, "").replace(/<\\/A>$/i, "").replace(/<[^>]*>/g, "").trim());
      if (safeUrl(url)) rows.push({ url: safeUrl(url), title: title || url, folder: folders.join("/") || "Imported" });
    }
  }
  return rows;
}
function safePreferences(input) {
  if (!input || typeof input !== "object") return {};
  return Object.fromEntries(Object.entries(input).filter(([key, value]) => PREFERENCE_KEYS.has(key) && ["string", "boolean", "number"].includes(typeof value)));
}

/** Normalises user-owned browser data from JSON exports. Scramjet and Ultraviolet are runtimes, not standardised browser-data formats. */
export function inspectMigration(input, { source = "auto" } = {}) {
  let data = input;
  if (typeof input === "string") {
    if (/^\s*</.test(input)) data = { bookmarks: parseBookmarkHtml(input), format: "netscape-bookmarks-html" };
    else { try { data = JSON.parse(input); } catch { throw new TypeError("Import must be JSON or Netscape bookmark HTML."); } }
  }
  if (!data || typeof data !== "object") throw new TypeError("Unsupported import file.");
  const root = data.roots ? flattenBookmarksTree(Object.values(data.roots)) : [];
  const bookmarks = bookmarkRows(data.bookmarks || data.favorites || data.bookmarkList || root);
  const history = historyRows(data.history || data.visits || data.historyItems);
  const tabs = tabRows(data.tabs || data.session?.tabs || data.openTabs);
  const settings = safePreferences(data.settings);
  const detected = source !== "auto" ? source :
    /ultraviolet|uv-/i.test(String(data.source || data.app || data.format || "")) ? "ultraviolet" :
    /scramjet|sj-/i.test(String(data.source || data.app || data.format || "")) ? "scramjet" : "generic";
  return { schema: 1, source: detected, counts: { bookmarks: bookmarks.length, history: history.length, tabs: tabs.length, settings: Object.keys(settings).length }, data: { bookmarks, history, tabs, settings } };
}
export function applyMigration(preview, { bookmarks = [], history = [], tabs = [], settings = {}, mode = "merge" } = {}) {
  if (!preview || preview.schema !== 1 || !preview.data) throw new TypeError("Invalid migration preview.");
  if (!["merge", "replace"].includes(mode)) throw new TypeError("Migration mode must be merge or replace.");
  const incoming = preview.data;
  const combine = (current, added, key, replaceWhenPresent = false) => {
    const base = mode === "replace" && (!replaceWhenPresent || added.length) ? [] : current;
    const seen = new Set(base.map(item => item[key]));
    const result = [...base];
    for (const item of added) if (!seen.has(item[key])) { seen.add(item[key]); result.push(item); }
    return result;
  };
  const historyBase = mode === "replace" && incoming.history.length ? [] : history;
  const historySeen = new Set(historyBase.map(item => item.url + "|" + (item.visitedAt || "")));
  const mergedHistory = [...historyBase];
  for (const item of incoming.history) {
    const key = item.url + "|" + (item.visitedAt || "");
    if (!historySeen.has(key)) { historySeen.add(key); mergedHistory.push(item); }
  }
  return {
    bookmarks: combine(bookmarks, incoming.bookmarks, "url", true),
    history: mergedHistory.slice(0, 500),
    tabs: (mode === "replace" && incoming.tabs.length ? incoming.tabs : [...tabs, ...incoming.tabs]).slice(0, 40),
    settings: mode === "replace" && Object.keys(incoming.settings).length ? { ...incoming.settings } : { ...settings, ...incoming.settings }
  };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
/** Produces a Netscape bookmark HTML file accepted by common desktop browsers. */
export function exportBookmarksHtml(bookmarks = []) {
  const root = { folders: new Map(), links: [] };
  for (const item of bookmarkRows(bookmarks)) {
    const parts = String(item.folder || "Imported").split("/").map(part => part.trim()).filter(Boolean).slice(0, 8);
    let node = root;
    for (const part of parts) {
      if (!node.folders.has(part)) node.folders.set(part, { folders: new Map(), links: [] });
      node = node.folders.get(part);
    }
    node.links.push(item);
  }
  const render = node => {
    const links = node.links.map(item => `<DT><A HREF="${escapeHtml(item.url)}">${escapeHtml(item.title)}</A>`);
    const folders = [...node.folders.entries()].map(([name, child]) => `<DT><H3>${escapeHtml(name)}</H3>\n<DL><p>\n${render(child)}\n</DL><p>`);
    return [...links, ...folders].join("\n");
  };
  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n${render(root)}\n</DL><p>\n`;
}
export function exportPortableData({ bookmarks = [], history = [], tabs = [], settings = {} } = {}) {
  return {
    app: "Polaris", format: "polaris-portable-data", schema: 1, exportedAt: new Date().toISOString(),
    bookmarks: bookmarkRows(bookmarks), history: historyRows(history), tabs: tabRows(tabs), settings: safePreferences(settings)
  };
}
