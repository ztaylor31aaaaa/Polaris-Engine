import test from "node:test";
import assert from "node:assert/strict";
import { createFeatureProfile, createBrowserSurface, CompatibilityError } from "../src/index.js";

test("feature profile reports native capabilities without patching globals", () => {
  const fake = { fetch() {}, URL: class URL {}, navigator: { serviceWorker: { register() {} } } };
  const profile = createFeatureProfile({ globalObject: fake });
  assert.equal(profile.supports("fetch"), true);
  assert.equal(profile.supports("URL"), true);
  assert.equal(profile.supports("serviceWorker"), true);
  assert.equal(profile.supports("WebSocket"), false);
  assert.throws(() => profile.require(["fetch", "WebSocket"]), CompatibilityError);
  const surface = createBrowserSurface({ globalObject: fake, profile });
  assert.equal(surface.fetch, fake.fetch);
  assert.equal(surface.WebSocket, undefined);
  assert.equal(Object.isFrozen(surface), true);
});
