const DEFAULT_KEY = "polaris-engine";

export class JsonStore {
  constructor({ storage = globalThis.localStorage, key = DEFAULT_KEY } = {}) {
    this.storage = storage;
    this.key = key;
  }
  read(fallback) {
    try { const value = this.storage?.getItem(this.key); return value == null ? fallback : JSON.parse(value); }
    catch { return fallback; }
  }
  write(value) {
    if (!this.storage) throw new Error("Persistent storage is unavailable.");
    this.storage.setItem(this.key, JSON.stringify(value));
    return value;
  }
  clear() { this.storage?.removeItem(this.key); }
}

export class BookmarkStore {
  constructor(options = {}) { this.store = new JsonStore({ ...options, key: options.key || "polaris-engine-bookmarks" }); }
  list() { return this.store.read([]); }
  add({ url, title = url, folder = "Unsorted" }) {
    const items = this.list();
    const normal = new URL(url);
    if (!["http:", "https:"].includes(normal.protocol)) throw new TypeError("Only HTTP and HTTPS bookmarks are supported.");
    const existing = items.find(item => item.url === normal.href);
    if (existing) return existing;
    const item = { id: globalThis.crypto?.randomUUID?.() || String(Date.now()), url: normal.href, title: String(title).slice(0, 160), folder: String(folder).slice(0, 60), createdAt: new Date().toISOString() };
    items.push(item); this.store.write(items); return item;
  }
  remove(id) { const items = this.list().filter(item => item.id !== id); this.store.write(items); return items; }
}

export class HistoryStore {
  constructor({ limit = 500, ...options } = {}) { this.limit = limit; this.store = new JsonStore({ ...options, key: options.key || "polaris-engine-history" }); }
  list() { return this.store.read([]); }
  add(url, title = url) {
    const normal = new URL(url);
    if (!["http:", "https:"].includes(normal.protocol)) throw new TypeError("Only HTTP and HTTPS history entries are supported.");
    const items = this.list().filter(item => item.url !== normal.href);
    items.unshift({ url: normal.href, title: String(title).slice(0, 160), visitedAt: new Date().toISOString() });
    this.store.write(items.slice(0, this.limit));
  }
  clear() { this.store.clear(); }
}
