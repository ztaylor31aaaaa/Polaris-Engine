# Polaris custom renderer and runtime

Polaris now contains an experimental, iframe-independent HTML rendering pipeline. The renderer owns its document model and paints it through Canvas 2D. The existing iframe adapter is a separate optional fallback.

## Architecture

- `HTMLParser`: tokenises basic HTML into Polaris-owned nodes.
- `DocumentNode`, `ElementNode`, `TextNode`: the renderer's document tree.
- `StyleDeclaration` and `StyleEngine`: inline style mutation, CSS cascade, selectors and responsive media rules.
- `LayoutEngine`: block/inline flow and an initial flexbox implementation.
- `PaintEngine`: backgrounds, borders, text and decoded raster images.
- `ResourceLoader`: bounded HTTP(S) fetches using the host browser's ordinary CORS and credential rules.
- `PolarisDocumentRuntime`: DOM-like methods, element properties, events, focus, forms and mutation observation.
- `PolarisHistory` and `RendererViewport`: navigation history, resize and scroll state.
- `ImageResourceLoader`: host-decoded raster image resources.
- `ScriptRuntime` + `PolarisScriptBridge`: an adapter boundary for a separately isolated JavaScript engine.
- `buildAccessibilityTree`: a basic semantic accessibility representation.

## Quick start

```js
import { PolarisRenderer } from "@polaris/engine/renderer";

const canvas = document.querySelector("canvas");
const renderer = new PolarisRenderer({
  canvas,
  onNavigate: (url) => console.log("Navigation requested:", url)
});
renderer.setHTML("<main><h1>Hello Polaris</h1><p>Rendered without an iframe.</p></main>");
```

For network-loaded documents, use `await renderer.loadURL("https://example.com/")`. Resource requests use native Fetch, only HTTP(S), normal CORS enforcement, timeouts, and response-size limits. A host can pass a `RendererNetworkPolicy` to further restrict allowed origins. This is not a proxy and does not bypass authentication, CORS, CSP, network policy, or website framing restrictions.

## JavaScript execution boundary

Polaris does **not** run downloaded page scripts in its own application JavaScript realm. The `ScriptRuntime` requires an explicitly supplied `engine` adapter implementing `createContext({ bridge, permissions, limits })`, returning a context with `evaluate(source, { filename, timeoutMs })` and `dispose()`.

This is an integration point for a genuinely isolated engine such as a separately hosted QuickJS/WASM runtime. The bridge exposes a small allowlist of document operations; it is not a general host-object tunnel. Without an isolated engine adapter, scripts are not executed. JavaScript modules, dynamic imports, timers/async scheduling compatibility and full browser globals are not yet implemented. Do not connect an adapter that evaluates untrusted page source in the Polaris host realm.

## Supported foundation

- Basic HTML tags, attributes, comments, text, void elements and raw-text elements.
- DOM tree traversal, basic query selectors, attributes, classes, text, element creation, sibling helpers and form control properties.
- CSS tag, class, ID, attribute, descendant, child and sibling selectors; structural pseudo-classes; inline declarations; specificity; `!important`; responsive width/height/orientation/color-scheme media queries.
- Basic block and inline flow, rudimentary flex row/column alignment, pixel/percentage dimensions, box sizing, margins, padding and borders.
- Canvas backgrounds, border edges, text and host-decoded images.
- Bubbling/capturing event listeners, cancellation, once listeners, focus state and basic mutation observer delivery through runtime-mediated operations.
- GET and URL-encoded form data, history state, basic navigation callbacks, viewport resize/scroll and accessibility-tree generation.

## Compatibility gaps

This is not Chromium, WebKit or Gecko and does not claim full browser compatibility. The HTML parser is not a complete WHATWG tree builder. CSS grid, floats, full flex sizing/wrapping, stacking contexts, transforms, pseudo-elements, animations, SVG rendering, advanced typography, full form validation, full pointer/keyboard event semantics, accessibility platform integration, WebSocket integration with page JS, workers, service workers, IndexedDB DOM bindings, WebAssembly and module scripts remain incomplete. Layout and painting are early implementations and will need browser conformance tests before broad site compatibility.

The renderer capability profile is exported through `getRendererCapabilities()` so callers can check what is actually implemented. Ported source should be migrated against these explicit APIs rather than assuming a native browser surface exists.
