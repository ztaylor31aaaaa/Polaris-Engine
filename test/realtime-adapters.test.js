import test from "node:test";
import assert from "node:assert/strict";
import { WebSocketAdapter, EventSourceAdapter, BroadcastChannelAdapter } from "../src/platform/realtime-adapters.js";

class FakeSocket extends EventTarget {
  static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
  constructor(url) { super(); this.url = url; this.readyState = 0; this.bufferedAmount = 0; this.protocol = ""; FakeSocket.last = this; }
  open() { this.readyState = 1; this.dispatchEvent(new Event("open")); }
  send(value) { this.sent = value; }
  close() { this.readyState = 3; this.dispatchEvent(new Event("close")); }
}
class FakeEventSource extends EventTarget {
  static CONNECTING = 0; static OPEN = 1; static CLOSED = 2;
  constructor(url, options) { super(); this.url = url; this.withCredentials = options.withCredentials; this.readyState = 0; FakeEventSource.last = this; }
  open() { this.readyState = 1; this.dispatchEvent(new Event("open")); }
  close() { this.readyState = 2; }
}
class FakeChannel extends EventTarget {
  constructor(name) { super(); this.name = name; FakeChannel.last = this; }
  postMessage(data) { this.sent = data; }
  close() { this.closed = true; }
}

test("WebSocket adapter validates origin, connects, sends and disposes", async () => {
  const adapter = new WebSocketAdapter({ WebSocketImpl: FakeSocket, allowedOrigins: ["wss://example.com"] });
  const pending = adapter.connect("wss://example.com/socket");
  FakeSocket.last.open();
  await pending;
  assert.equal(adapter.send("hello"), 0);
  assert.equal(FakeSocket.last.sent, "hello");
  adapter.dispose();
  assert.equal(adapter.getState(), null);
  const restricted = new WebSocketAdapter({ WebSocketImpl: FakeSocket, allowedOrigins: [] });
  await assert.rejects(() => restricted.connect("wss://example.com"), /origin/i);
});

test("WebSocket adapter rejects non-WebSocket protocols", async () => {
  const adapter = new WebSocketAdapter({ WebSocketImpl: FakeSocket });
  await assert.rejects(() => adapter.connect("https://example.com"), /Unsupported URL protocol/);
});

test("EventSource adapter connects and closes", async () => {
  const adapter = new EventSourceAdapter({ EventSourceImpl: FakeEventSource, allowedOrigins: ["https://example.com"] });
  const pending = adapter.connect("https://example.com/events");
  FakeEventSource.last.open();
  await pending;
  assert.equal(adapter.getState().readyState, 1);
  adapter.dispose();
  assert.equal(adapter.getState(), null);
});

test("BroadcastChannel adapter forwards messages and closes", () => {
  const adapter = new BroadcastChannelAdapter("test", { BroadcastChannelImpl: FakeChannel });
  const received = [];
  adapter.on("message", event => received.push(event.data));
  const event = new Event("message");
  event.data = { ok: true };
  FakeChannel.last.dispatchEvent(event);
  adapter.postMessage({ sent: true });
  assert.deepEqual(received, [{ ok: true }]);
  assert.deepEqual(FakeChannel.last.sent, { sent: true });
  adapter.dispose();
  assert.equal(FakeChannel.last.closed, true);
});
