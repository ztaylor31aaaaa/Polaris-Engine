import test from "node:test";
import assert from "node:assert/strict";
import { FetchAdapter, FetchTimeoutError } from "../src/platform/fetch-adapter.js";

test("resolves relative URLs and applies default and request headers", async () => {
  let received;
  const adapter = new FetchAdapter({
    baseURL: "https://example.test/app/",
    headers: { "x-engine": "polaris" },
    fetchImpl: async (url, init) => {
      received = { url, init };
      return new Response("ok", { status: 200 });
    },
  });
  const response = await adapter.get("../data", { headers: { "x-request": "yes" } });
  assert.equal(response.status, 200);
  assert.equal(received.url, "https://example.test/data");
  assert.equal(received.init.headers.get("x-engine"), "polaris");
  assert.equal(received.init.headers.get("x-request"), "yes");
});

test("rejects non HTTP(S) schemes", async () => {
  const adapter = new FetchAdapter({ fetchImpl: async () => new Response() });
  await assert.rejects(() => adapter.fetch("javascript:alert(1)"), /HTTP and HTTPS/);
});

test("emits lifecycle events for successful responses", async () => {
  const events = [];
  const adapter = new FetchAdapter({ fetchImpl: async () => new Response("ok") });
  for (const type of ["fetch:start", "fetch:response", "fetch:finish"]) {
    adapter.on(type, () => events.push(type));
  }
  await adapter.fetch("https://example.test/");
  assert.deepEqual(events, ["fetch:start", "fetch:response", "fetch:finish"]);
});

test("turns an aborted timed-out request into a typed timeout error", async () => {
  const adapter = new FetchAdapter({
    timeout: 5,
    fetchImpl: (_url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason || new Error("aborted")), { once: true });
    }),
  });
  await assert.rejects(() => adapter.fetch("https://example.test/"), FetchTimeoutError);
});

test("caller abort is preserved as an abort rather than a timeout", async () => {
  const controller = new AbortController();
  const adapter = new FetchAdapter({
    timeout: 0,
    fetchImpl: (_url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("caller aborted")), { once: true });
    }),
  });
  const request = adapter.fetch("https://example.test/", { signal: controller.signal });
  controller.abort();
  await assert.rejects(request, /caller aborted/);
});

test("convenience methods set their HTTP method", async () => {
  const methods = [];
  const adapter = new FetchAdapter({
    fetchImpl: async (_url, init) => {
      methods.push(init.method);
      return new Response(null, { status: 204 });
    },
  });
  await adapter.post("https://example.test/", "body");
  await adapter.put("https://example.test/");
  await adapter.patch("https://example.test/");
  await adapter.delete("https://example.test/");
  assert.deepEqual(methods, ["POST", "PUT", "PATCH", "DELETE"]);
});
