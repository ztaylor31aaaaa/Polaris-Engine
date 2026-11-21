# Native Fetch adapter

Polaris Engine's `FetchAdapter` is a small wrapper around the platform Fetch API. It adds shared request defaults, URL resolution, cancellation, timeouts and lifecycle events without replacing or emulating the browser networking stack.

## Import

```js
import { FetchAdapter, FetchTimeoutError } from "@polaris/engine";
```

## Configure and use

```js
const api = new FetchAdapter({
  baseURL: "https://api.example.test/v1/",
  timeout: 12000,
  headers: { "x-client": "polaris" },
  credentials: "same-origin",
});

api.on("fetch:response", event => {
  console.log(event.status, event.duration);
});

const response = await api.get("status");
if (!response.ok) throw new Error(`HTTP ${response.status}`);

const result = await api.post("records", JSON.stringify({ name: "Example" }), {
  headers: { "content-type": "application/json" },
});
```

## Behaviour

- Relative URLs resolve against `baseURL`; absolute URLs are accepted when they use HTTP or HTTPS.
- Request headers override configured default headers.
- A `Request` input retains its method, body and other request options.
- Set `timeout: 0` on the adapter or individual request to disable the timeout.
- Pass an `AbortSignal` through `init.signal` to cancel from the caller.
- Timeouts reject with `FetchTimeoutError`; caller cancellation remains a normal Fetch abort.
- HTTP error statuses are returned as normal `Response` objects. Check `response.ok` or `response.status`.
- The adapter does not bypass CORS, browser permissions, content-security policy, network filters or server authentication.

## Events

| Event | Payload |
| --- | --- |
| `fetch:start` | `{ url, method, timeout }` |
| `fetch:response` | `{ url, method, status, ok, duration }` |
| `fetch:error` | `{ url, method, error }` |
| `fetch:finish` | `{ url, method }` |

Use the returned unsubscribe function from `api.on(event, listener)` to stop listening.
