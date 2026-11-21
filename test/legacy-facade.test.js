import test from "node:test";
import assert from "node:assert/strict";
import { createLegacyMigrationFacade } from "../src/migration/legacy-facade.js";

function setup() {
  const tabs = {
    tabs: [], activeId: null,
    create({ title, url, pinned, group }) {
      const tab = { id: "tab-" + (this.tabs.length + 1), title, url, pinned, group };
      this.tabs.push(tab); this.activeId = tab.id; return tab;
    },
    update(id, patch) { const tab = this.tabs.find(item => item.id === id); Object.assign(tab, patch); },
    close(id) { this.tabs = this.tabs.filter(item => item.id !== id); if (this.activeId === id) this.activeId = this.tabs.at(-1)?.id || null; }
  };
  const frames = new Map();
  const views = {
    async mount({ tabId, url }) { const frame = { tabId, src: url }; frames.set(tabId, frame); return frame; },
    async unmount({ tabId }) { frames.delete(tabId); },
    getFrame(id) { return frames.get(id) || null; },
    getStatus(id) { return frames.has(id) ? { state: "load-observed" } : null; },
    on() { return () => {}; }
  };
  const stopped = [];
  const runtimes = { async start() {}, async stop(id) { stopped.push(id); } };
  return { tabs, views, frames, runtimes, stopped };
}

test("legacy facade opens, navigates and closes Polaris-managed tabs", async () => {
  const state = setup();
  const facade = createLegacyMigrationFacade(state);
  await facade.init();
  const first = await facade.open("https://example.com");
  assert.equal(first.tab.url, "https://example.com/");
  assert.equal(facade.getFrame(first.tab.id).src, "https://example.com/");
  await facade.navigate("https://example.org");
  assert.equal(state.tabs.tabs.length, 1);
  assert.equal(facade.getFrame(first.tab.id).src, "https://example.org/");
  assert.equal(await facade.close(first.tab.id), true);
  assert.equal(state.tabs.tabs.length, 0);
  assert.deepEqual(state.stopped, [first.tab.id]);
});

test("legacy facade rejects non-web URLs", async () => {
  const state = setup();
  const facade = createLegacyMigrationFacade(state);
  await assert.rejects(facade.open("javascript:alert(1)"), /HTTP\(S\)/);
});

test("legacy facade cleans up a runtime if view mounting fails", async () => {
  const state = setup();
  state.views.mount = async () => { throw new Error("mount failed"); };
  const facade = createLegacyMigrationFacade(state);
  await assert.rejects(facade.open("https://example.com"), /mount failed/);
  assert.equal(state.tabs.tabs.length, 0);
  assert.deepEqual(state.stopped, ["tab-1"]);
});
