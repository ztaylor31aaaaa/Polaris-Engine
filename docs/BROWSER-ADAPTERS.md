# Browser capability adapters

These opt-in wrappers expose native browser capabilities with a consistent event and disposal pattern. They do not bypass browser permissions or security requirements.

## Clipboard

`ClipboardAdapter` provides `readText()` and `writeText(text)`. Clipboard access generally requires a secure context and may require transient user activation or browser permission. The browser may reject either operation.

## Fullscreen

`FullscreenAdapter` provides `enter(element)`, `exit()`, `toggle(element)`, `getState()` and `fullscreen:change` / `fullscreen:error` events. Fullscreen requests remain subject to browser user-activation rules.

## Visibility and connectivity

`VisibilityAdapter` reports visible/hidden document state. `ConnectivityAdapter` reports online/offline events and exposes optional Network Information API fields when available. The online flag is only a browser connectivity hint; it does not guarantee that a server is reachable.

## Media queries

`MediaQueryAdapter` wraps `matchMedia(query)`, exposes its current state, and emits `media:change` events. It is useful for reacting to colour scheme, reduced motion, pointer type, viewport breakpoints and similar browser preferences.

## Example

```js
import { ClipboardAdapter, VisibilityAdapter, MediaQueryAdapter } from "@polaris/engine/browser";

const clipboard = new ClipboardAdapter();
const visibility = new VisibilityAdapter();
const reducedMotion = new MediaQueryAdapter("(prefers-reduced-motion: reduce)");

visibility.on("visibility:change", state => console.log(state));
reducedMotion.on("media:change", state => console.log(state.matches));

// Dispose event listeners when the owning tab/runtime is destroyed.
visibility.dispose();
reducedMotion.dispose();
```

All wrappers are native feature adapters. Unsupported APIs, permissions, user-activation requirements and browser policies remain in effect.
