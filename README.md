# Polaris Engine

Polaris Engine is a modular browser-runtime framework for the Polaris ecosystem. The first milestone establishes the independent foundation: URL resolution, navigation state, tab/session management, bookmarks, history, events, diagnostics, and a small Polaris integration bridge.

This is an early framework, not a complete browser engine. It does not claim feature parity with Scramjet yet. Network proxying, HTML rewriting, service-worker interception, and transport adapters are deliberately separate future components and must only be used in environments where the relevant functionality is authorised.

## Requirements
- Node.js 20+
- Modern browser for the Polaris bridge

## Development
```bash
npm test
```

## Current modules
- **URL resolver:** normalises HTTP(S) URLs and turns plain text into a configurable search URL.
- **Navigation controller:** manages current URL, back/forward history, reload and navigation events.
- **Tab manager:** creates, activates, closes and restores tabs.
- **Session store:** versioned JSON import/export with validation.
- **Bookmarks and history:** lightweight persistent stores with injectable storage.
- **Diagnostics:** capability checks and structured runtime events.

## Project status
Milestone 0.1 — framework foundation. See [docs/ROADMAP.md](docs/ROADMAP.md).
