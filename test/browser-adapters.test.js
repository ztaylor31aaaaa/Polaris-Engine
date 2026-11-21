import test from "node:test";
import assert from "node:assert/strict";
import { ClipboardAdapter, FullscreenAdapter, VisibilityAdapter, ConnectivityAdapter, MediaQueryAdapter } from "../src/platform/browser-adapters.js";

class Target extends EventTarget {}
test("ClipboardAdapter delegates text read and write", async () => {
  let value = "";
  const adapter = new ClipboardAdapter({ clipboard: { async readText() { return value; }, async writeText(next) { value = next; } } });
  await adapter.writeText("Polaris");
  assert.equal(await adapter.readText(), "Polaris");
  await assert.rejects(() => adapter.writeText(42), /string/);
});

test("FullscreenAdapter tracks state and removes listeners", async () => {
  const doc = new Target();
  doc.fullscreenElement = null;
  doc.exitFullscreen = async () => { doc.fullscreenElement = null; doc.dispatchEvent(new Event("fullscreenchange")); };
  const element = { async requestFullscreen() { doc.fullscreenElement = element; doc.dispatchEvent(new Event("fullscreenchange")); } };
  const adapter = new FullscreenAdapter({ documentRef: doc });
  await adapter.enter(element);
  assert.equal(adapter.getState().active, true);
  await adapter.exit();
  assert.equal(adapter.getState().active, false);
  adapter.dispose();
});

test("VisibilityAdapter reports document visibility", () => {
  const doc = new Target(); doc.visibilityState = "visible"; doc.hidden = false;
  const adapter = new VisibilityAdapter({ documentRef: doc });
  const states = [];
  adapter.on("visibility:change", state => states.push(state));
  doc.visibilityState = "hidden"; doc.hidden = true; doc.dispatchEvent(new Event("visibilitychange"));
  assert.equal(states[0].hidden, true);
  adapter.dispose();
});

test("ConnectivityAdapter reports online and offline events", () => {
  const win = new Target(); const nav = { onLine: true };
  const adapter = new ConnectivityAdapter({ navigatorRef: nav, windowRef: win });
  const states = [];
  adapter.on("connectivity:change", state => states.push(state));
  nav.onLine = false; win.dispatchEvent(new Event("offline"));
  assert.equal(states[0].online, false);
  adapter.dispose();
});

test("MediaQueryAdapter reports match changes", () => {
  const media = new Target(); media.matches = false; media.media = "(prefers-reduced-motion: reduce)";
  const adapter = new MediaQueryAdapter(media.media, { matchMediaImpl: () => media });
  const changes = [];
  adapter.on("media:change", state => changes.push(state));
  media.matches = true;
  const event = new Event("change"); Object.defineProperties(event, { matches: { value: true }, media: { value: media.media } });
  media.dispatchEvent(event);
  assert.equal(changes[0].matches, true);
  adapter.dispose();
});
