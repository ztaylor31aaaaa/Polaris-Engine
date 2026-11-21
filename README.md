# Polaris Engine

Polaris Engine is a modular browser-runtime framework for Polaris. Version 0.6 adds a Scramjet/Ultraviolet code-migration toolkit, a command-line project scanner, an expanded native API compatibility profile and portable-data migration.

## Feature groups

- **Navigation:** URL resolution and inspection, same-origin checks, history state and navigation events.
- **Tabs and sessions:** tab lifecycle, pinning, groups, closed-tab recovery and session serialisation.
- **Runtime:** per-tab runtime lifecycle, resource disposal, abort scopes and runtime limits.
- **Custom renderer (experimental):** Polaris-owned document tree, HTML parser, CSS cascade and media queries, block/inline/basic flex layout, Canvas 2D painter, DOM events/mutations, form controls, history, images, accessibility tree, and a worker RPC boundary for an externally supplied isolated JavaScript engine. It does not use an iframe for its own rendering path; see [docs/RENDERER.md](docs/RENDERER.md).
- **Document views:** optional HTTP(S) iframe mounting and cleanup through an adapter; subject to browser framing restrictions.
- **Platform APIs:** browser feature detection, native Fetch adapter, WebSocket, Server-Sent Events and BroadcastChannel adapters, Web Worker lifecycle, MessagePort RPC and expanded browser capability catalogue.
- **Frames:** iframe lifecycle controller, sandbox defaults, explicit-origin messaging and frame events.
- **Plugins:** dependency-aware plugin activation, shutdown ordering and cleanup.
- **URL watching:** detects history, hash and page lifecycle URL changes.
- **DOM:** MutationObserver wrapper with subscription and disposal.
- **Storage:** JSON settings, bookmarks, history, namespaced local/session storage with cross-document change events, named session snapshots, IndexedDB and Cache Storage wrappers.
- **Security:** scoped permission grants and URL origin policy.
- **Extensibility:** extension lifecycle and application command registry.
- **Utilities:** MIME lookup, URL metadata, same-origin checks, relative URL resolution and performance metrics.
- **Diagnostics:** structured browser capability checks.
- **Transport configuration:** host-registered provider selection, explicit enable/disable, optional startup initialisation, cancellation, timeout and typed lifecycle errors. No provider is bundled or enabled by default.
- **Data migration:** preview-first JSON and Netscape bookmark HTML import/export for bookmarks, history, tabs and non-sensitive preferences.
- **Code migration:** static Scramjet/Ultraviolet reference scanning, migration plans, API mapping suggestions, guarded developer-controlled source replacements with line previews, a lifecycle compatibility facade and component-file scanning.
- **Migration CLI:** `polaris-migrate ./your-project --out migration-plan.json` scans an existing project without modifying its files; add `--format markdown --out migration-report.md` for ordered steps, affected file/line locations and starter code examples.

## Runtime safety

The core package does not automatically register a service worker, load Scramjet bundles, initialise a proxy transport, rewrite requests or connect to proxy endpoints. Browser APIs are exposed as opt-in modules. This keeps importing or starting the framework separate from any proxy subsystem.

## Development

Requires Node.js 20 or newer.

```bash
npm install
npm run check
npm test
```

## Website rendering: current status

Polaris now includes an **experimental custom canvas renderer** with its own document model, HTML parser, CSS style engine, layout engine and paint engine. This is the beginning of a separate rendering path rather than an iframe wrapper. It currently handles a limited HTML/CSS subset and does not execute page JavaScript or provide full browser compatibility. The ordinary iframe adapter remains optional and is still subject to `X-Frame-Options` and Content Security Policy `frame-ancestors` restrictions. See [docs/RENDERER.md](docs/RENDERER.md) for supported features and gaps.

## Other limitations

Polaris Engine is not a complete browser engine and does not yet have full Scramjet or Ultraviolet feature parity. The code migration toolkit is a static analyser and controlled codemod foundation, not a universal one-click converter. Runtime APIs differ between legacy versions and applications, so developers must review the generated migration plan and test each port. Platform adapters wrap native browser functionality; they do not emulate missing APIs or make blocked network connections work.

See [docs/ROADMAP.md](docs/ROADMAP.md), [docs/TRANSPORT.md](docs/TRANSPORT.md), [docs/MIGRATION.md](docs/MIGRATION.md), [docs/CODE-MIGRATION.md](docs/CODE-MIGRATION.md), [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md), [docs/FETCH-ADAPTER.md](docs/FETCH-ADAPTER.md), [docs/REALTIME-ADAPTERS.md](docs/REALTIME-ADAPTERS.md), [docs/WEB-STORAGE.md](docs/WEB-STORAGE.md) and [docs/SESSION-PERSISTENCE.md](docs/SESSION-PERSISTENCE.md), and [docs/RENDERER.md](docs/RENDERER.md).
