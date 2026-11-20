# Polaris Engine

Polaris Engine is a modular browser-runtime framework for Polaris. Version 0.5 adds an explicit transport-provider lifecycle, validated connection timeouts, portable-data migration and browser bookmark HTML import on top of the modular runtime foundation.

## Feature groups

- **Navigation:** URL resolution and inspection, same-origin checks, history state and navigation events.
- **Tabs and sessions:** tab lifecycle, pinning, groups, closed-tab recovery and session serialisation.
- **Runtime:** per-tab runtime lifecycle, resource disposal, abort scopes and runtime limits.
- **Document views:** HTTP(S) iframe mounting and cleanup through an adapter.
- **Platform APIs:** browser feature detection, native Web Worker lifecycle, MessagePort RPC and expanded diagnostics for 24 browser capabilities.
- **Frames:** iframe lifecycle controller, sandbox defaults, explicit-origin messaging and frame events.
- **Plugins:** dependency-aware plugin activation, shutdown ordering and cleanup.
- **URL watching:** detects history, hash and page lifecycle URL changes.
- **DOM:** MutationObserver wrapper with subscription and disposal.
- **Storage:** JSON settings, bookmarks, history and Cache Storage wrapper.
- **Security:** scoped permission grants and URL origin policy.
- **Extensibility:** extension lifecycle and application command registry.
- **Utilities:** MIME lookup, URL metadata, same-origin checks, relative URL resolution and performance metrics.
- **Diagnostics:** structured browser capability checks.\n- **Transport configuration:** host-registered provider selection, explicit enable/disable, optional startup initialisation, cancellation, timeout and typed lifecycle errors. No provider is bundled or enabled by default.\n- **Data migration:** preview-first JSON and Netscape bookmark HTML import/export for bookmarks, history, tabs and non-sensitive preferences.

## Runtime safety

The core package does not automatically register a service worker, load Scramjet bundles, initialise a proxy transport, rewrite requests or connect to proxy endpoints. Browser APIs are exposed as opt-in modules. This keeps importing or starting the framework separate from any proxy subsystem.

## Development

Requires Node.js 20 or newer.

```bash
npm test
npm run check
```

## Limitations

Polaris Engine is not a complete browser engine and does not yet have full Scramjet feature parity. Its view adapter uses normal browser iframe behaviour and is subject to browser security and framing policies. Platform APIs wrap native browser functionality rather than attempting to emulate every browser implementation detail.

See [docs/ROADMAP.md](docs/ROADMAP.md), [docs/TRANSPORT.md](docs/TRANSPORT.md) and [docs/MIGRATION.md](docs/MIGRATION.md).
