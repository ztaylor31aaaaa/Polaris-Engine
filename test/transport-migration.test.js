import test from "node:test";
import assert from "node:assert/strict";
import { TransportProviderManager, SettingsManager, inspectMigration, applyMigration, exportPortableData } from "../src/index.js";

test("transport provider requires explicit enable and selection", async () => {
  let initialised = 0;
  const provider = { id: "mock", initialize: async () => { initialised++; }, connect: async () => "connected", disconnect: async () => {} };
  const manager = new TransportProviderManager({ providers: [provider], selected: "mock" });
  await assert.rejects(manager.initialise(), /disabled/);
  await manager.configure({ enabled: true, selected: "mock" });
  await manager.initialise();
  assert.equal(initialised, 1);
  assert.equal((await manager.connect()), "connected");
  await manager.disable();
  assert.equal(manager.status().state, "disabled");
});

test("migration imports safe URLs and ignores unsupported schemes", () => {
  const preview = inspectMigration({ app: "Ultraviolet", bookmarks: [{ title: "Docs", url: "https://example.com" }, { url: "javascript:alert(1)" }], tabs: [{ url: "https://example.org" }], settings: { theme: "dark", secret: "ignored" } });
  assert.equal(preview.source, "ultraviolet");
  assert.equal(preview.counts.bookmarks, 1);
  assert.equal(preview.data.settings.secret, undefined);
  const result = applyMigration(preview);
  assert.equal(result.bookmarks[0].url, "https://example.com/");
  assert.equal(result.tabs.length, 1);
});

test("portable export can be re-imported", () => {
  const file = exportPortableData({ bookmarks: [{ url: "https://example.com" }] });
  const preview = inspectMigration(file);
  assert.equal(preview.counts.bookmarks, 1);
});

test("transport connection timeout aborts provider work", async () => {
  const manager = new TransportProviderManager({
    providers: [{ id: "slow", initialize: async () => {}, connect: ({ signal }) => new Promise((resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true })) }],
    selected: "slow", connectTimeout: 1000
  });
  await manager.configure({ enabled: true, selected: "slow", connectTimeout: 1000 });
  await assert.rejects(manager.connect(), /timed out|aborted/i);
  assert.equal(manager.status().state, "error");
});

test("migration excludes credential-like settings and merges tabs", () => {
  const preview = inspectMigration({ settings: { theme: "dark", apiKey: "secret", accessToken: "secret" }, tabs: [{ url: "https://new.example" }] });
  const result = applyMigration(preview, { tabs: [{ title: "Existing", url: "https://old.example" }] });
  assert.equal(result.settings.apiKey, undefined);
  assert.equal(result.settings.accessToken, undefined);
  assert.equal(result.tabs.length, 2);
});

test("migration reads Netscape bookmarks HTML exports", () => {
  const preview = inspectMigration('<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><DT><A HREF="https://example.com/?a=1&amp;b=2">Example &amp; Docs</A></DL>');
  assert.equal(preview.counts.bookmarks, 1);
  assert.equal(preview.data.bookmarks[0].url, "https://example.com/?a=1&b=2");
  assert.equal(preview.data.bookmarks[0].title, "Example & Docs");
});

test("migration reads Chrome-style bookmark trees", () => {
  const preview = inspectMigration({ roots: { bookmark_bar: { children: [{ name: "Docs", url: "https://example.com" }] } } });
  assert.equal(preview.counts.bookmarks, 1);
});

test("settings manager validates and persists transport preferences", () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const settings = new SettingsManager({ storage });
  settings.setMany({ transportEnabled: true, transportProvider: "mock", transportConnectTimeout: 5000 });
  assert.equal(settings.get("transportEnabled"), true);
  assert.equal(settings.get("transportProvider"), "mock");
  assert.equal(settings.get("transportConnectTimeout"), 5000);
  assert.throws(() => settings.set("transportConnectTimeout", 10), /between 1000 and 120000/);
});
