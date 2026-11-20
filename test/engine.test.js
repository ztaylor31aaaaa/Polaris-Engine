import test from "node:test";
import assert from "node:assert/strict";
import { resolveAddress, isWebAddress, TabManager, NavigationController } from "../src/index.js";

test("resolves hostnames and search terms", () => {
  assert.equal(resolveAddress("example.com"), "https://example.com/");
  assert.match(resolveAddress("hello world"), /^https:\/\/www\.google\.com\/search\?q=hello%20world$/);
});

test("rejects unsupported protocols", () => {
  assert.throws(() => resolveAddress("javascript:alert(1)"), /Only HTTP and HTTPS/);
  assert.equal(isWebAddress("file:///etc/passwd"), false);
});

test("tab manager creates, closes and reopens tabs", () => {
  const tabs = new TabManager();
  const first = tabs.create({ title: "First" });
  tabs.create({ title: "Second" });
  assert.equal(tabs.tabs.length, 2);
  tabs.close();
  assert.equal(tabs.tabs.length, 1);
  assert.equal(tabs.reopen().title, "Second");
  assert.equal(tabs.active.id !== first.id, true);
});

test("navigation maintains back and forward state", async () => {
  const opened = [];
  const nav = new NavigationController({ openDocument: url => opened.push(url) });
  await nav.navigate("example.com");
  await nav.navigate("https://example.org");
  await nav.back();
  assert.equal(nav.current.url, "https://example.com/");
  await nav.forward();
  assert.equal(nav.current.url, "https://example.org/");
  assert.equal(opened.length, 4);
});
