import test from "node:test";
import assert from "node:assert/strict";
import { WebStorageAdapter } from "../src/storage/web-storage-adapter.js";

class MemoryStorage {
  values = new Map();
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(String(key), String(value)); }
  removeItem(key) { this.values.delete(key); }
}

class FakeWindow {
  listeners = new Map();
  addEventListener(type, fn) {
    const set = this.listeners.get(type) || new Set();
    set.add(fn);
    this.listeners.set(type, set);
  }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  dispatch(type, event) { for (const fn of this.listeners.get(type) || []) fn(event); }
}

test("stores JSON values under a namespace", () => {
  const storage = new MemoryStorage();
  const adapter = new WebStorageAdapter({ storage, prefix: "app:" });
  adapter.set("settings", { theme: "dark", scale: 1.1 });
  assert.deepEqual(adapter.get("settings"), { theme: "dark", scale: 1.1 });
  assert.deepEqual(adapter.keys(), ["settings"]);
  assert.equal(storage.getItem("app:settings"), JSON.stringify({ theme: "dark", scale: 1.1 }));
  assert.equal(adapter.get("missing", "fallback"), "fallback");
});

test("does not modify keys outside its namespace when clearing", () => {
  const storage = new MemoryStorage();
  storage.setItem("other:data", "keep");
  const adapter = new WebStorageAdapter({ storage, prefix: "polaris:" });
  adapter.set("one", 1);
  adapter.set("two", 2);
  assert.equal(adapter.clear(), 2);
  assert.equal(storage.getItem("other:data"), "keep");
  assert.deepEqual(adapter.keys(), []);
});

test("emits local change events with old and new values", () => {
  const adapter = new WebStorageAdapter({ storage: new MemoryStorage(), listen: false });
  const changes = [];
  adapter.on("storage:change", event => changes.push(event));
  adapter.set("count", 1);
  adapter.set("count", 2);
  adapter.remove("count");
  assert.deepEqual(changes.map(x => [x.oldValue, x.newValue, x.external]), [
    [null, 1, false], [1, 2, false], [2, null, false],
  ]);
});

test("receives matching cross-document storage events only", () => {
  const storage = new MemoryStorage();
  const windowObject = new FakeWindow();
  const adapter = new WebStorageAdapter({ storage, prefix: "p:", windowObject });
  const changes = [];
  adapter.on("storage:change", event => changes.push(event));
  windowObject.dispatch("storage", {
    key: "p:theme", oldValue: '"light"', newValue: '"dark"', storageArea: storage,
  });
  windowObject.dispatch("storage", {
    key: "other:theme", oldValue: null, newValue: '"dark"', storageArea: storage,
  });
  assert.equal(changes.length, 1);
  assert.deepEqual(changes[0], {
    key: "theme", oldValue: "light", newValue: "dark", external: true,
  });
});

test("validates keys and rejects values JSON cannot encode", () => {
  const adapter = new WebStorageAdapter({ storage: new MemoryStorage() });
  assert.throws(() => adapter.get(""), /non-empty/);
  assert.throws(() => adapter.set("undefined", undefined), /JSON/);
  const circular = {};
  circular.self = circular;
  assert.throws(() => adapter.set("circular", circular));
});

test("dispose removes the storage listener and prevents further use", () => {
  const windowObject = new FakeWindow();
  const adapter = new WebStorageAdapter({ storage: new MemoryStorage(), windowObject });
  assert.equal(windowObject.listeners.get("storage").size, 1);
  adapter.dispose();
  assert.equal(windowObject.listeners.get("storage").size, 0);
  assert.throws(() => adapter.get("anything"), /disposed/);
  adapter.dispose();
});
