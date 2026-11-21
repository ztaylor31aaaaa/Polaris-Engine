# Polaris Engine

Polaris Engine is a modular browser-runtime framework for Polaris. Version 0.6 adds a Scramjet/Ultraviolet code-migration toolkit, a command-line project scanner, an expanded native API compatibility profile and portable-data migration.

## Feature groups

- **Navigation:** URL resolution and inspection, same-origin checks, history state and navigation events.
- **Tabs and sessions:** tab lifecycle, pinning, groups, closed-tab recovery and session serialisation.
- **Runtime:** per-tab runtime lifecycle, resource disposal, abort scopes and runtime limits.
- **Document views:** HTTP(S) iframe mounting and cleanup through an adapter.
- **Platform APIs:** browser feature detection, native Web Worker lifecycle, MessagePort RPC and expanded browser capability catalogue.
- **Frames:** iframe lifecycle controller, sandbox defaults, explicit-origin messaging and frame events.
- **Plugins:** dependency-aware plugin activation, shutdown ordering and cleanup.
- **URL watching:** detects history, hash and page lifecycle URL changes.
- **DOM:** MutationObserver wrapper with subscription and disposal.
- **Storage:** JSON settings, bookmarks, history and Cache Storage wrapper.
- **Security:** scoped permission grants and URL origin policy.
- **Extensibility:** extension lifecycle and application command registry.
- **Utilities:** MIME lookup, URL metadata, same-origin checks, relative URL resolution and performance metrics.
- **Diagnostics:** structured browser capability checks.
- **Transport configuration:** host-registered provider selection, explicit enable/disable, optional startup initialisation, cancellation, timeout and typed lifecycle errors. No provider is bundled or enabled by default.
- **Data migration:** preview-first JSON and Netscape bookmark HTML import/export for bookmarks, history, tabs and non-sensitive preferences.
- **Code migration:** static Scramjet/Ultraviolet reference scanning, migration plans, API mapping suggestions, guarded developer-controlled source replacements with line previews, a lifecycle compatibility facade and component-file scanning.
- **Migration CLI:** `polaris-migrate ./your-project --out migration-plan.json` scans an existing project without modifying its files.

## Runtime safety

The core package does not automatically register a service worker, load Scramjet bundles, initialise a proxy transport, rewrite requests or connect to proxy endpoints. Browser APIs are exposed as opt-in modules. This keeps importing or starting the framework separate from any proxy subsystem.

## Development

Requires Node.js 20 or newer.

```bash
npm install
npm run check
npm test
```

## Limitations

Polaris Engine is not a complete browser engine and does not yet have full Scramjet or Ultraviolet feature parity. The code migration toolkit is a static analyser and controlled codemod foundation, not a universal one-click converter. Runtime APIs differ between legacy versions and applications, so developers must review the generated migration plan and test each port. The view adapter uses normal browser iframe behaviour and is subject to browser security and framing policies. Platform APIs wrap native browser functionality rather than attempting to emulate every browser implementation detail.

See [docs/ROADMAP.md](docs/ROADMAP.md), [docs/TRANSPORT.md](docs/TRANSPORT.md), [docs/MIGRATION.md](docs/MIGRATION.md), [docs/CODE-MIGRATION.md](docs/CODE-MIGRATION.md) and [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md).
