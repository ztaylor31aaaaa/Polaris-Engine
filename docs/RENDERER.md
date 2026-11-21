# Polaris custom renderer (early foundation)

Polaris now has an experimental, canvas-based HTML renderer. It does not use an iframe to display its document tree.

## Current pipeline

`HTMLParser` converts an HTML string into Polaris-owned `DocumentNode`, `ElementNode`, and `TextNode` objects. `StyleEngine` parses stylesheets, matches a limited selector set, and computes basic cascaded styles. `LayoutEngine` calculates an initial box tree. `PaintEngine` paints backgrounds, borders, and text to a Canvas 2D context. `PolarisRenderer` coordinates the pipeline and provides resize, stylesheet, and basic link-click hooks.

## Quick start

```js
import { PolarisRenderer } from "@polaris/engine/renderer";

const canvas = document.querySelector("canvas");
const view = new PolarisRenderer({
  canvas,
  onNavigate: (href) => console.log("Navigation requested:", href)
});
view.setHTML("<main><h1>Hello Polaris</h1><p>Rendered without an iframe.</p></main>");
```

## Supported in this foundation

- Basic HTML tokenisation, elements, attributes, text, comments, void elements, and raw-text style/script/title/textarea content.
- Basic CSS declarations, comma-separated rules, tag/class/id/attribute selectors, descendant and child combinators, inheritance for common text properties, and inline styles.
- Basic block and inline flow, rudimentary flex row flow, pixel and percentage dimensions, margin/padding, and simple text measurement.
- Canvas painting for backgrounds, text, and a basic border outline.
- Basic hit testing and anchor navigation callbacks.

## Not yet browser-compatible

This is a rendering foundation, not a full browser engine. It does not yet implement a standards-compliant HTML5 tree builder, full CSS cascade/layout (grid, floats, positioning, transforms, pseudo-elements, animations, complex flex sizing), image decoding/painting, forms, accessibility tree, full event propagation, DOM mutation observers, modules, or a JavaScript page runtime. Script elements are parsed as text and are **not executed**. It does not bypass browser security boundaries, CORS, CSP, authentication, or network policy.

Ported application code should target the Polaris document/runtime interfaces as they are implemented. Code depending on unimplemented browser APIs must be adapted or deferred. The existing iframe adapter remains a separate optional compatibility fallback; it is not the custom renderer.
