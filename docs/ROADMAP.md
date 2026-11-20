# Roadmap

## 0.1 — Foundation
- [x] URL parsing and search-term resolution
- [x] Navigation state and event lifecycle
- [x] Tab management
- [x] Session import/export
- [x] Bookmark and history stores
- [x] Runtime diagnostics
- [ ] Polaris UI integration verification

## 0.2 — Browser integration
- [ ] Pluggable document-view adapters
- [ ] Per-tab lifecycle and cleanup hooks
- [ ] Permission and capability reporting
- [ ] Resource timing and error telemetry
- [ ] Automated browser tests

## 0.3 — Compatibility layer
- [ ] Compatibility profiles and feature detection
- [ ] Storage adapters with explicit origin boundaries
- [ ] Standards-based request lifecycle hooks
- [ ] WebSocket capability reporting and tests

## Later
A full browser runtime is a large project. HTML/CSS/JavaScript rewriting, service-worker routing, and transport implementations require separate designs, security review, licensing review, and compatibility tests. No milestone should claim Scramjet parity until it is demonstrated by a repeatable test suite.
