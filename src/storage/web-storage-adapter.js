import { EventBus } from "../utils/events.js";

/**
 * Namespaced wrapper for native localStorage/sessionStorage.
 * Values are JSON encoded; no storage globals are modified.
 */
export class WebStorageAdapter {
  constructor({
    storage = globalThis.localStorage,
    prefix = "polaris:",
    windowObject = globalThis.window,
    listen = true,
  } = {}) {
    if (!storage || typeof storage.getItem !== "function" ||
        typeof storage.setItem !== "function" ||
        typeof storage.removeItem !== "function") {
      throw new TypeError("A Web Storage-compatible object is required.");
    }
    if (typeof prefix !== "string") throw new TypeError("prefix must be a string.");
    this.storage = storage;
    this.prefix = prefix;
    this.windowObject = windowObject;
    this.events = new EventBus();
    this.disposed = false;
    this.handleStorage = event => {
      if (event.storageArea && event.storageArea !== this.storage) return;
      if (event.key !== null && !event.key.startsWith(this.prefix)) return;
      this.events.emit("storage:change", {
        key: event.key === null ? null : event.key.slice(this.prefix.length),
        oldValue: this.#parse(event.oldValue),
        newValue: this.#parse(event.newValue),
        external: true,
      });
    };
    if (listen) this.windowObject?.addEventListener?.("storage", this.handleStorage);
  }

  #assertActive() {
    if (this.disposed) throw new Error("WebStorageAdapter has been disposed.");
  }

  #key(key) {
    if (typeof key !== "string" || key.length === 0) {
      throw new TypeError("Storage keys must be non-empty strings.");
    }
    return this.prefix + key;
  }

  #parse(value) {
    if (value === null || value === undefined) return null;
    try { return JSON.parse(value); }
    catch { return value; }
  }

  on(type, listener) {
    this.#assertActive();
    return this.events.on(type, listener);
  }

  get(key, fallback = null) {
    this.#assertActive();
    const raw = this.storage.getItem(this.#key(key));
    if (raw === null) return fallback;
    try { return JSON.parse(raw); }
    catch { return fallback; }
  }

  set(key, value) {
    this.#assertActive();
    const storageKey = this.#key(key);
    const previous = this.get(key, null);
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new TypeError("Value cannot be represented as JSON.");
    this.storage.setItem(storageKey, encoded);
    this.events.emit("storage:change", {
      key, oldValue: previous, newValue: value, external: false,
    });
    return value;
  }

  remove(key) {
    this.#assertActive();
    const storageKey = this.#key(key);
    const previous = this.get(key, null);
    this.storage.removeItem(storageKey);
    this.events.emit("storage:change", {
      key, oldValue: previous, newValue: null, external: false,
    });
  }

  keys() {
    this.#assertActive();
    const result = [];
    for (let index = 0; index < this.storage.length; index += 1) {
      const key = this.storage.key(index);
      if (key?.startsWith(this.prefix)) result.push(key.slice(this.prefix.length));
    }
    return result;
  }

  clear() {
    this.#assertActive();
    const keys = this.keys();
    for (const key of keys) this.storage.removeItem(this.#key(key));
    this.events.emit("storage:clear", { keys });
    return keys.length;
  }

  dispose() {
    if (this.disposed) return;
    this.windowObject?.removeEventListener?.("storage", this.handleStorage);
    this.events.emit("storage:dispose", {});
    this.events.clear?.();
    this.disposed = true;
  }
}
