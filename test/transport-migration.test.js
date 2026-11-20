import test from "node:test";
import assert from "node:assert/strict";
import { TransportProviderManager, inspectMigration, applyMigration, exportPortableData } from "../src/index.js";

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
