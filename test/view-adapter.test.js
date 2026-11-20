import test from "node:test";
import assert from "node:assert/strict";
import { ViewAdapter } from "../src/adapters/view-adapter.js";

class FakeFrame {
  constructor() { this.listeners = new Map(); this.dataset = {}; this.isConnected = false; }
  addEventListener(type, fn) { this.listeners.set(type, fn); }
  removeEventListener(type) { this.listeners.delete(type); }
  setAttribute() {}
  remove() { this.isConnected = false; }
  fire(type, value = {}) { this.listeners.get(type)?.(value); }
}
function setup(options = {}) {
  const frame = new FakeFrame();
  const container = { append(node) { node.isConnected = true; } };
  return { frame, adapter: new ViewAdapter({ container, createFrame: () => frame, ...options }) };
}

test("reports iframe load as observed, not as verified HTTP success", async () => {
  const { frame, adapter } = setup({ loadTimeout: 0 });
  const events = [];
  adapter.on("view:state", event => events.push(event.state));
  await adapter.mount({ tabId: "a", url: "https://example.com" });
  frame.fire("load");
  assert.equal(adapter.getStatus("a").state, "load-observed");
  assert.deepEqual(events, ["loading", "load-observed"]);
  assert.match(adapter.getStatus("a").detail, /HTTP status/);
});

test("surfaces host transport errors with a stage and code", async () => {
  const { adapter } = setup({ loadTimeout: 0 });
  await adapter.mount({ tabId: "a", url: "https://example.com" });
  assert.equal(adapter.reportError({ tabId: "a", stage: "transport", code: "CONNECTION_FAILED", message: "Connection failed" }), true);
  assert.equal(adapter.getStatus("a").state, "error");
  assert.equal(adapter.getStatus("a").stage, "transport");
  assert.equal(adapter.getStatus("a").error.code, "CONNECTION_FAILED");
});

test("rejects non-web URLs and clears frame state on unmount", async () => {
  const { adapter } = setup({ loadTimeout: 0 });
  await assert.rejects(adapter.mount({ tabId: "a", url: "javascript:alert(1)" }), /HTTP\(S\)/);
  await adapter.mount({ tabId: "a", url: "https://example.com" });
  assert.equal(await adapter.unmount({ tabId: "a" }), true);
  assert.equal(adapter.getFrame("a"), null);
  assert.equal(adapter.getStatus("a").state, "unmounted");
});
