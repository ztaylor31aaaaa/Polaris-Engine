# Roadmap

Polaris Engine aims to become a modular browser-runtime and document compatibility framework. The long-term compatibility goal is broad feature coverage comparable to projects such as Scramjet, but milestones must be demonstrated with repeatable tests and clear security boundaries.

## 0.1 — Foundation
- [x] URL parsing and search-term resolution
- [x] Navigation state and event lifecycle
- [x] Tab management
- [x] Session import/export
- [x] Bookmark and history stores
- [x] Runtime diagnostics
- [ ] Polaris UI integration verification

## 0.2 — Browser integration
- [x] Pluggable document-view adapter foundation
- [x] Per-tab lifecycle and cleanup hooks
- [x] Permission and capability reporting foundation
- [x] View load-state and host-reported transport error events
- [ ] Resource timing and error telemetry expansion
- [ ] Automated browser tests

## 0.3 — Compatibility layer
- [x] Browser API feature detection
- [x] Storage primitives and cache adapter
- [x] WebSocket capability reporting
- [ ] Compatibility profiles and feature detection matrix
- [ ] Storage adapters with explicit origin boundaries
- [ ] Standards-based request lifecycle hooks
- [ ] WebSocket lifecycle tests

## 0.4 — Runtime and extension APIs
- [x] Per-tab runtime lifecycle
- [x] Disposable resource scopes
- [x] Permission manager and origin policy
- [x] Settings manager
- [x] Extension registry and dependency-aware plugin manager
- [x] Command registry
- [x] Worker manager and MessagePort RPC
- [x] DOM observer and URL watcher
- [x] MIME utilities
- [ ] Stable public API documentation and semantic-versioning policy
- [ ] Browser integration test matrix

## 0.5 — Transport configuration and portable migration (implemented foundation)\n- [x] Explicit transport-provider registration and selection API\n- [x] Transport enable/disable and optional startup initialisation settings\n- [x] Typed lifecycle state and error events\n- [x] Preview-first JSON migration for bookmarks, history, tabs and safe preferences\n- [x] Portable export format and migration documentation\n- [ ] Add a real permitted provider integration and provider conformance suite\n- [ ] Add browser-level end-to-end migration tests\n\n## 0.6 — Advanced browser compatibility
- [ ] Document lifecycle model: navigation start, redirects when observable, commit, load, abort and failure
- [ ] Structured diagnostics for frame restrictions, CSP, sandboxing, cookie/storage restrictions and browser policy failures
- [ ] Standard request/response metadata interfaces where exposed by the host platform
- [ ] Resource timing, performance entries and per-tab telemetry
- [ ] More complete cookie, IndexedDB, Cache Storage and session-storage adapters within browser origin rules
- [ ] Streams, workers, messaging and WebSocket conformance tests
- [ ] Compatibility profiles with explicit supported/unsupported API tables
- [ ] Reference demo application and end-to-end tests

## 0.7 — Pluggable transport integration
- [ ] Stable transport-provider interface for applications that have an independently operated and authorised transport
- [ ] Provider lifecycle: initialise, connect, request/navigation result, report failure, disconnect and dispose
- [ ] Typed transport errors, cancellation, timeouts and diagnostic events
- [ ] Capability negotiation and provider health reporting
- [ ] Example in-memory/mock provider for tests
- [ ] Integration documentation explaining host responsibilities, deployment requirements and security boundaries
- [ ] Tests proving that transport providers cannot silently escalate engine permissions

The engine can define a provider contract and expose lifecycle/error hooks. A provider is supplied and operated by the integrating application; the engine does not silently select an external proxy or attempt to defeat network access controls.

## Long-term compatibility target — Scramjet-inspired feature coverage
- [ ] Publish a feature-by-feature compatibility matrix against publicly documented browser-runtime behaviours
- [ ] Document transformation-independent browser APIs and runtime contracts
- [ ] Improve document, storage, worker, messaging, streaming and navigation compatibility
- [ ] Add conformance tests for every claimed capability
- [ ] Review licensing, security, origin isolation and browser-platform limitations before adopting third-party implementation techniques

“Full Scramjet parity” is an aspirational compatibility target, not a claim that Polaris currently implements Scramjet. Proxy routing, traffic rewriting, concealment, or mechanisms intended to bypass a network administrator's access controls are not part of the engine's default runtime. Any transport integration must be explicitly configured by the host application and used only where the operator has permission.

## Release criteria
- Every checked roadmap item has automated tests or a documented manual verification procedure.
- Diagnostics distinguish observable failures from browser-hidden cross-origin details.
- Security-sensitive features have explicit permissions, origin boundaries and cleanup behaviour.
- No release claims parity based only on API names or a successful iframe load.
