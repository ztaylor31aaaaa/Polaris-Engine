/**
 * Named browser-session snapshots backed by a WebStorageAdapter-compatible store.
 * Snapshots contain tab metadata only; credentials and page storage are not exported.
 */
const SESSION_SCHEMA = 1;
const DEFAULT_LIMIT = 20;
const MAX_NAME_LENGTH = 80;
const MAX_TABS = 100;

function validateName(name) {
  if (typeof name !== "string" || !name.trim() || name.length > MAX_NAME_LENGTH) {
    throw new TypeError("Session names must be non-empty strings up to 80 characters.");
  }
  return name.trim();
}

function validateSnapshot(snapshot) {
  if (!snapshot || snapshot.schema !== SESSION_SCHEMA ||
      !Array.isArray(snapshot.tabs) || snapshot.tabs.length > MAX_TABS) {
    throw new TypeError("Invalid or unsupported Polaris session snapshot.");
  }
  const ids = new Set();
  for (const tab of snapshot.tabs) {
    if (!tab || typeof tab.id !== "string" || !tab.id ||
        typeof tab.title !== "string" || typeof tab.url !== "string" ||
        typeof tab.pinned !== "boolean" || typeof tab.group !== "string" ||
        ids.has(tab.id)) {
      throw new TypeError("Session snapshot contains an invalid tab.");
    }
    ids.add(tab.id);
  }
  if (snapshot.activeId !== null && snapshot.activeId !== undefined &&
      !ids.has(snapshot.activeId)) {
    throw new TypeError("Session activeId does not match a saved tab.");
  }
  return snapshot;
}

export class SessionPersistence {
  constructor({ storage, key = "sessions", limit = DEFAULT_LIMIT, clock = Date.now } = {}) {
    if (!storage || typeof storage.get !== "function" ||
        typeof storage.set !== "function" || typeof storage.remove !== "function") {
      throw new TypeError("A WebStorageAdapter-compatible storage instance is required.");
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new RangeError("Session limit must be an integer from 1 to 100.");
    }
    if (typeof clock !== "function") throw new TypeError("clock must be a function.");
    this.storage = storage;
    this.key = validateName(key);
    this.limit = limit;
    this.clock = clock;
  }

  #read() {
    const value = this.storage.get(this.key, []);
    if (!Array.isArray(value)) return [];
    return value.filter(item => {
      try {
        validateName(item?.name);
        validateSnapshot(item?.snapshot);
        return Number.isFinite(item.savedAt);
      } catch {
        return false;
      }
    });
  }

  save(name, tabManager) {
    const safeName = validateName(name);
    if (!tabManager || typeof tabManager.serialise !== "function") {
      throw new TypeError("save() requires a TabManager-compatible instance.");
    }
    const snapshot = validateSnapshot(tabManager.serialise());
    const sessions = this.#read().filter(item => item.name !== safeName);
    sessions.unshift({ name: safeName, savedAt: this.clock(), snapshot });
    this.storage.set(this.key, sessions.slice(0, this.limit));
    return { name: safeName, savedAt: sessions[0].savedAt, tabCount: snapshot.tabs.length };
  }

  load(name) {
    const safeName = validateName(name);
    const entry = this.#read().find(item => item.name === safeName);
    return entry ? structuredClone(entry.snapshot) : null;
  }

  restore(name, tabManager) {
    if (!tabManager || typeof tabManager.restore !== "function") {
      throw new TypeError("restore() requires a TabManager-compatible instance.");
    }
    const snapshot = this.load(name);
    if (!snapshot) return null;
    return tabManager.restore(snapshot);
  }

  list() {
    return this.#read().map(({ name, savedAt, snapshot }) => ({
      name, savedAt, tabCount: snapshot.tabs.length,
    }));
  }

  remove(name) {
    const safeName = validateName(name);
    const sessions = this.#read();
    const next = sessions.filter(item => item.name !== safeName);
    if (next.length === sessions.length) return false;
    this.storage.set(this.key, next);
    return true;
  }

  clear() {
    const count = this.#read().length;
    this.storage.remove(this.key);
    return count;
  }
}
