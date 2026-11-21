# Browser API compatibility profiles

The compatibility profile gives ported code a reliable way to inspect the native APIs available in the current browser before it runs.

```js
import { createFeatureProfile, createBrowserSurface } from "@polaris/engine";

const profile = createFeatureProfile();
console.table(profile.features);
profile.require(["fetch", "URL", "MessageChannel"]);

const browser = createBrowserSurface({ profile });
if (profile.supports("ReadableStream")) {
  // Prefer checking profile.supports("ReadableStream") for feature gates.
}
```

The profile reports availability; it does not emulate missing APIs, monkey-patch globals, or claim that an API has identical behaviour across browsers. Each entry is marked native and grouped by area. Use `profile.require([...])` to fail early with a `CompatibilityError` listing missing features.

Current catalogue groups include network primitives, URL/navigation, storage, workers, messaging, streams, compression, encoding, cryptography, DOM observers, performance, files, WebAssembly, graphics, WebGPU, WebTransport, WebRTC, media APIs, file-system access, scheduling and the Navigation API.

For code ports, prefer feature detection over browser-name checks. Keep graceful fallbacks for missing APIs, and test behaviour rather than relying only on the presence of a global.
