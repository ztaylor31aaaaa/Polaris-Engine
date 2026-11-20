# Polaris Engine

Polaris Engine is a modular browser-runtime framework for the Polaris ecosystem. Version 0.2 adds a per-tab runtime lifecycle, disposable resource scopes, permission and origin policies, settings, extension and command registries, performance metrics, and a pluggable document-view adapter.

## Modules

- **Navigation:** HTTP(S) URL resolution, history state, back/forward/reload events.
- **Tabs and sessions:** create, activate, pin, group, close, reopen, serialise and restore tabs.
- **Runtime lifecycle:** independent per-tab runtimes, start/suspend/resume/stop, abort signals, resource cleanup and runtime limits.
- **View adapter:** mounts and unmounts HTTP(S) documents into a supplied container. This is a display adapter, not a network proxy.
- **Security:** permission grants scoped by tab or globally; URL protocol, host and embedded-credential policy.
- **Settings:** validated persistent settings with change/reset events.
- **Extensions:** register, activate, deactivate and unregister extension modules with cleanup callbacks.
- **Commands:** register and execute app commands with metadata and shortcuts.
- **Storage:** JSON, bookmarks and bounded history stores.
- **Telemetry:** bounded performance samples with min/max/average/p95 summaries.
- **Diagnostics:** browser API capability checks.

## Basic use

```js
import { TabManager, RuntimeManager, SettingsManager, PermissionManager } from "@polaris/engine";

const tabs = new TabManager();
const tab = tabs.create({ title: "Start page" });
const runtimes = new RuntimeManager();
await runtimes.start(tab.id, { url: "https://example.com" });

const permissions = new PermissionManager();
permissions.grant(tab.id, "fullscreen");

const settings = new SettingsManager();
settings.set("theme", "dark");
```

## Development

Requires Node.js 20 or newer.

```bash
npm test
npm run check
```

## Important limitations

This is a browser-runtime framework, not a complete browser engine and not yet Scramjet feature parity. The view adapter relies on normal browser iframe rules and site framing policies. It does not rewrite website code, intercept or disguise network traffic, or bypass network controls. Transport, document transformation and service-worker components remain separate future milestones and must be used only where authorised.

See [docs/ROADMAP.md](docs/ROADMAP.md).
