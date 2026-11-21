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

The `WorkerEngineAdapter` and `installPolarisScriptWorker` provide the host/worker RPC protocol for a separately bundled engine such as QuickJS/WASM. The worker-side host forwards approved DOM bridge calls to Polaris and enforces message/context limits. The actual interpreter implementation must still be supplied by the host; Polaris does not bundle a complete JavaScript interpreter. The bridge exposes an allowlist of document operations; it is not a general host-object tunnel. Without an isolated engine adapter, scripts are not executed. JavaScript modules, dynamic imports, timers/async scheduling compatibility and full browser globals are not yet implemented. Do not connect an adapter that evaluates untrusted page source in the Polaris host realm.

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

## Expanded isolated DOM bridge

The optional `PolarisDOMBridge` extends the initial script bridge with a larger, explicit DOM operation set for an external isolated JavaScript engine. It supports element and text-node creation, document queries, safe element-property access, tree insertion/removal, text and HTML mutation, inline style access, selector matching, ancestry/traversal, bounding boxes, focus, and event subscriptions.

The bridge intentionally exposes a property allowlist. It does not expose `window`, `globalThis`, cookies, arbitrary host objects, direct network access, or a host-realm evaluation function. Event payloads are serialised into a bounded queue. Requests are size-limited and unknown methods are rejected.

Example engine adapter integration:

```js
import { PolarisRenderer, ScriptRuntime } from "@polaris/engine";
import { createQuickJsAdapter } from "./your-isolated-engine-adapter.js";

const engine = createQuickJsAdapter();
const scripts = new ScriptRuntime({ engine });
const renderer = new PolarisRenderer({ canvas, scriptRuntime: scripts });
await renderer.loadURL("https://example.org/");
```

`createQuickJsAdapter` above is an application-supplied adapter, not a built-in Polaris export. The adapter must implement the documented isolated context contract. The bridge alone does not make JavaScript execution available; the default capability remains disabled until a compatible engine is configured and tested.

## Renderer-backed frame compatibility

`PolarisFrameCompatibility` provides a frame-shaped host object for code that previously expected a frame controller. Its `frame` property is the supplied canvas element, while `contentWindow` and `contentDocument` expose the supported Polaris facade. The `go(url)` and `load(url)` methods load a document through the renderer; `setHTML(html)` installs an in-memory document. The facade also exposes a restricted `location`, `history`, `navigator`, `screen`, event-target methods, scrolling, sizing and basic window timers.

```js
import { createPolarisFrame } from "@polaris/engine/renderer/frame-compatibility";

const view = createPolarisFrame({
  canvas: document.querySelector("#page-surface"),
  onNavigate(url) { console.info("Polaris navigation:", url); }
});

await view.go("https://example.org/");
console.log(view.contentDocument.title);
view.destroy();
```

This is a compatibility facade, not a native browser frame. It does not implement every `Window`, `Document`, `HTMLElement`, or `HTMLIFrameElement` member, and it does not execute arbitrary page scripts by itself. Network loads use the host browser's ordinary fetch behavior and remain subject to CORS, CSP, authentication, server headers and network policy. The facade is intended to make migration of frame lifecycle and document access easier while unsupported APIs are identified and implemented deliberately.
