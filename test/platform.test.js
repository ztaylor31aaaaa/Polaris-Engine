import test from "node:test";
import assert from "node:assert/strict";
import { detectPlatform, requirePlatformFeatures, inspectUrl, normaliseWebUrl, sameOrigin, resolveRelativeUrl, mimeFromExtension, extensionFromMime, isTextMime, normaliseMime } from "../src/index.js";

test("platform detection reports browser feature availability", () => {
  const report = detectPlatform({ URL, fetch() {}, AbortController });
  assert.equal(report.checks.length > 10, true);
  assert.equal(report.available.includes("URL"), true);
  assert.equal(report.available.includes("fetch"), true);
});

test("required platform feature check reports missing features", () => {
  assert.throws(() => requirePlatformFeatures(["missingFeature"], {}), /missingFeature/);
});

test("URL inspection returns useful metadata without throwing on invalid input", () => {
  const info = inspectUrl("https://example.com:443/path?q=1#top");
  assert.equal(info.valid, true);
  assert.equal(info.isSecure, true);
  assert.equal(info.hostname, "example.com");
  assert.equal(inspectUrl("not a URL").valid, false);
});

test("URL tools enforce web protocols and resolve relative references", () => {
  assert.equal(normaliseWebUrl("https://example.com"), "https://example.com/");
  assert.throws(() => normaliseWebUrl("javascript:alert(1)"), /HTTP and HTTPS/);
  assert.equal(sameOrigin("https://example.com/a", "https://example.com/b"), true);
  assert.equal(resolveRelativeUrl("../b", "https://example.com/a/c"), "https://example.com/b");
});

test("MIME helpers map common extensions and validate values", () => {
  assert.equal(mimeFromExtension("index.html"), "text/html");
  assert.equal(extensionFromMime("image/png"), "png");
  assert.equal(isTextMime("application/json"), true);
  assert.equal(normaliseMime("TEXT/HTML; charset=utf-8"), "text/html");
  assert.equal(normaliseMime("not a mime"), "application/octet-stream");
});

import { PluginManager, UrlWatcher } from "../src/index.js";

test("plugin manager enables dependencies before dependents and cleans them up", async () => {
  const calls = [];
  const manager = new PluginManager();
  manager.register({ name: "base", setup: () => { calls.push("base+"); return () => calls.push("base-"); } });
  manager.register({ name: "feature", dependencies: ["base"], setup: () => { calls.push("feature+"); return () => calls.push("feature-"); } });
  await manager.enable("feature");
  await manager.disable("base");
  assert.deepEqual(calls, ["base+", "feature+", "feature-", "base-"]);
});

test("URL watcher notifies subscribers only when the observed URL changes", () => {
  let href = "https://example.com/a";
  const fakeWindow = { location: {}, addEventListener() {}, removeEventListener() {} };
  Object.defineProperty(fakeWindow.location, "href", { get: () => href });
  const watcher = new UrlWatcher(fakeWindow);
  const changes = [];
  watcher.subscribe(change => changes.push(change));
  href = "https://example.com/b";
  assert.equal(watcher.check(), true);
  assert.equal(watcher.check(), false);
  assert.equal(changes.length, 1);
  watcher.stop();
});
