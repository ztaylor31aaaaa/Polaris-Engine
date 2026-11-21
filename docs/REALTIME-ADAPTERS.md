# Realtime platform adapters

Polaris Engine provides thin, opt-in wrappers around native browser realtime APIs. These adapters do not provide a relay, proxy, URL rewriting, or network-policy workaround.

## WebSocket

```js
import { WebSocketAdapter } from "@polaris/engine/realtime";
const socket = new WebSocketAdapter({ connectionTimeout: 8000, allowedOrigins: ["wss://example.com"] });
socket.on("socket:message", event => console.log(event.data));
await socket.connect("wss://example.com/events");
socket.send(JSON.stringify({ type: "hello" }));
socket.dispose();
```

The adapter validates ws/wss URLs, can restrict origins, supports connection timeout and AbortSignal, reports lifecycle events, and applies a configurable send-buffer ceiling. The browser and server still decide whether the connection is permitted.

## Server-Sent Events

```js
import { EventSourceAdapter } from "@polaris/engine/realtime";
const events = new EventSourceAdapter({ allowedOrigins: ["https://example.com"] });
events.on("eventsource:message", event => console.log(event.data));
await events.connect("https://example.com/updates");
events.dispose();
```

EventSource retains native reconnect behaviour. A temporary error event does not necessarily mean the stream is permanently closed.

## BroadcastChannel

```js
import { BroadcastChannelAdapter } from "@polaris/engine/realtime";
const channel = new BroadcastChannelAdapter("polaris-tabs");
channel.on("message", event => console.log(event.data));
channel.postMessage({ type: "tab-updated" });
channel.dispose();
```

BroadcastChannel communicates between compatible same-origin browsing contexts. It is not a cross-origin messaging mechanism.

## Limitations

These are native API adapters, not emulations. Feature availability, CORS, CSP, server configuration, browser permissions, and network policy still apply. They do not make blocked connections work.
