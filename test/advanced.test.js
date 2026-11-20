import test from "node:test";
import assert from "node:assert/strict";
import {
  DisposableStack, TabRuntime, RuntimeManager, PermissionManager, OriginPolicy,
  SettingsManager, ExtensionRegistry, CommandRegistry, PerformanceMonitor
} from "../src/index.js";

test("disposable stack runs cleanup in reverse order and only once", async () => {
  const order = [];
  const stack = new DisposableStack();
  stack.defer(() => order.push(1));
  stack.defer(() => order.push(2));
  await stack.dispose();
  await stack.dispose();
  assert.deepEqual(order, [2, 1]);
});

test("tab runtime follows start, suspend, resume and stop lifecycle", async () => {
  const calls = [];
  const runtime = new TabRuntime({ tabId: "a", adapter: {
    start: () => calls.push("start"), suspend: () => calls.push("suspend"),
    resume: () => calls.push("resume"), stop: () => calls.push("stop")
  }});
  await runtime.start();
  await runtime.suspend();
  await runtime.resume();
  await runtime.stop();
  assert.deepEqual(calls, ["start", "suspend", "resume", "stop"]);
  assert.equal(runtime.state, "stopped");
});

test("runtime manager enforces lifecycle and removes stopped runtimes", async () => {
  const manager = new RuntimeManager();
  await manager.start("tab-1");
  assert.ok(manager.get("tab-1"));
  await manager.stop("tab-1");
  assert.equal(manager.get("tab-1"), null);
});

test("permission manager scopes grants and rejects unknown permissions", () => {
  const permissions = new PermissionManager();
  permissions.grant("tab-1", "fullscreen");
  assert.equal(permissions.has("tab-1", "fullscreen"), true);
  assert.equal(permissions.has("tab-2", "fullscreen"), false);
  assert.throws(() => permissions.grant("tab-1", "root-access"), /Unknown permission/);
});

test("origin policy rejects unsafe protocols and credential URLs", () => {
  const policy = new OriginPolicy();
  assert.equal(policy.inspect("https://example.com").allowed, true);
  assert.equal(policy.inspect("javascript:alert(1)").allowed, false);
  assert.equal(policy.inspect("https://user:pass@example.com").allowed, false);
});

test("settings validate values and persist through injectable storage", () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const settings = new SettingsManager({ storage });
  settings.set("theme", "dark");
  assert.equal(new SettingsManager({ storage }).get("theme"), "dark");
  assert.throws(() => settings.set("zoom", 4), /Zoom/);
});

test("extension registry activates and cleans up extensions", async () => {
  let cleaned = false;
  const registry = new ExtensionRegistry();
  registry.register({ id: "test.extension", activate: () => () => { cleaned = true; } });
  await registry.enable("test.extension");
  await registry.disable("test.extension");
  assert.equal(cleaned, true);
});

test("command registry executes registered commands", async () => {
  const commands = new CommandRegistry();
  commands.register({ id: "ping", run: ({ value }) => value + 1 });
  assert.equal(await commands.execute("ping", { value: 4 }), 5);
});

test("performance monitor calculates summary statistics", () => {
  const monitor = new PerformanceMonitor();
  monitor.record("render", 10);
  monitor.record("render", 20);
  assert.deepEqual(monitor.summary("render"), { count: 2, min: 10, max: 20, average: 15, p95: 20 });
});
