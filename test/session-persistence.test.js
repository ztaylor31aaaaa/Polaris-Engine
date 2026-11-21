import test from "node:test";
import assert from "node:assert/strict";
import { SessionPersistence } from "../src/storage/session-persistence.js";
import { WebStorageAdapter } from "../src/storage/web-storage-adapter.js";
import { TabManager } from "../src/tabs/tab-manager.js";

class MemoryStorage {
  values = new Map();
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(String(key), String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function setup(options = {}) {
  const adapter = new WebStorageAdapter({ storage: new MemoryStorage(), listen: false });
  return { adapter, sessions: new SessionPersistence({ storage: adapter, ...options }) };
}

test("saves, lists, loads and restores a named tab session", () => {
  const { sessions } = setup({ clock: () => 1234 });
  const source = new TabManager();
  source.create({ title: "Search", url: "https://example.com" });
  source.create({ title: "Docs", url: "https://example.org/docs", pinned: true });
  const saved = sessions.save("Work", source);
  assert.deepEqual(saved, { name: "Work", savedAt: 1234, tabCount: 2 });
  assert.deepEqual(sessions.list(), [{ name: "Work", savedAt: 1234, tabCount: 2 }]);
  assert.equal(sessions.load("Work").tabs.length, 2);
  const target = new TabManager();
  assert.equal(sessions.restore("Work", target).length, 2);
  assert.deepEqual(target.tabs.map(tab => tab.url), [
    "https://example.com", "https://example.org/docs",
  ]);
});

test("re-saving a name replaces it and moves it to the top", () => {
  const { sessions } = setup({ clock: (() => { let n = 1; return () => n++; })() });
  const tabs = new TabManager();
  tabs.create({ title: "A", url: "https://a.example" });
  sessions.save("First", tabs);
  tabs.create({ title: "B", url: "https://b.example" });
  sessions.save("Second", tabs);
  sessions.save("First", tabs);
  assert.deepEqual(sessions.list().map(item => item.name), ["First", "Second"]);
  assert.equal(sessions.list()[0].savedAt, 3);
});

test("enforces the configured session limit", () => {
  const { sessions } = setup({ limit: 2 });
  const tabs = new TabManager();
  tabs.create();
  sessions.save("One", tabs);
  sessions.save("Two", tabs);
  sessions.save("Three", tabs);
  assert.deepEqual(sessions.list().map(item => item.name), ["Three", "Two"]);
});

test("returns null for missing sessions and false when removing missing names", () => {
  const { sessions } = setup();
  const tabs = new TabManager();
  assert.equal(sessions.load("Missing"), null);
  assert.equal(sessions.restore("Missing", tabs), null);
  assert.equal(sessions.remove("Missing"), false);
  sessions.save("Saved", tabs);
  assert.equal(sessions.remove("Saved"), true);
  assert.deepEqual(sessions.list(), []);
});

test("clear removes saved sessions and reports the count", () => {
  const { sessions } = setup();
  const tabs = new TabManager();
  sessions.save("One", tabs);
  sessions.save("Two", tabs);
  assert.equal(sessions.clear(), 2);
  assert.deepEqual(sessions.list(), []);
});

test("validates names, storage and tab manager inputs", () => {
  const { sessions } = setup();
  assert.throws(() => sessions.save("", new TabManager()), /Session names/);
  assert.throws(() => sessions.save("x", {}), /TabManager/);
  assert.throws(() => sessions.restore("x", {}), /TabManager/);
  assert.throws(() => new SessionPersistence({ storage: {} }), /storage instance/);
  assert.throws(() => new SessionPersistence({ storage: sessions.storage, limit: 0 }), /limit/);
});

test("ignores malformed records rather than failing the whole session list", () => {
  const { adapter, sessions } = setup();
  adapter.set("sessions", [
    { name: "Broken", savedAt: 1, snapshot: { schema: 999, tabs: [] } },
    { name: "Valid", savedAt: 2, snapshot: { schema: 1, activeId: null, tabs: [] } },
  ]);
  assert.deepEqual(sessions.list(), [{ name: "Valid", savedAt: 2, tabCount: 0 }]);
});
