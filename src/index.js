export { EventBus } from "./utils/events.js";
export { resolveAddress, isWebAddress } from "./navigation/url-resolver.js";
export { inspectUrl, normaliseWebUrl, sameOrigin, resolveRelativeUrl } from "./navigation/url-tools.js";
export { NavigationController } from "./navigation/controller.js";
export { UrlWatcher } from "./navigation/url-watcher.js";
export { TabManager } from "./tabs/tab-manager.js";
export { JsonStore, BookmarkStore, HistoryStore } from "./storage/stores.js";
export { WebStorageAdapter } from "./storage/web-storage-adapter.js";
export { SessionPersistence } from "./storage/session-persistence.js";
export { CacheStore } from "./storage/cache-store.js";
export { IndexedDBStore } from "./storage/indexeddb-store.js";
export { runDiagnostics } from "./diagnostics/index.js";
export { DisposableStack, createAbortScope } from "./runtime/disposable.js";
export { TabRuntime } from "./runtime/tab-runtime.js";
export { RuntimeManager } from "./runtime/runtime-manager.js";
export { PermissionManager } from "./security/permissions.js";
export { OriginPolicy } from "./security/origin-policy.js";
export { SettingsManager } from "./settings/settings-manager.js";
export { ExtensionRegistry } from "./extensions/extension-registry.js";
export { PluginManager } from "./extensions/plugin-manager.js";
export { CommandRegistry } from "./commands/command-registry.js";
export { PerformanceMonitor } from "./telemetry/performance-monitor.js";
export { ViewAdapter } from "./adapters/view-adapter.js";
export { FrameController } from "./adapters/frame-controller.js";
export { detectPlatform, requirePlatformFeatures } from "./platform/web-platform.js";
export { WorkerManager } from "./platform/worker-manager.js";
export { MessageRPC } from "./platform/message-rpc.js";
export { FetchAdapter, FetchTimeoutError } from "./platform/fetch-adapter.js";
export { WebSocketAdapter, EventSourceAdapter, BroadcastChannelAdapter } from "./platform/realtime-adapters.js";
export { DOMObserver } from "./dom/dom-observer.js";
export { mimeFromExtension, extensionFromMime, isTextMime, normaliseMime } from "./utils/mime.js";
export { TransportProviderManager } from "./transport/provider-manager.js";
export { inspectMigration, applyMigration, exportPortableData, exportBookmarksHtml } from "./migration/data-migration.js";
export { createFeatureProfile, createBrowserSurface, CompatibilityError } from "./compat/feature-profile.js";

export const ENGINE_NAME = "Polaris Engine";
export const ENGINE_VERSION = "0.6.1";

export { analyzeLegacyProject, convertLegacyProject, createMigrationPlan, createMigrationReport, renderMigrationReport, getMigrationMappings } from "./migration/code-migration.js";

export { createLegacyMigrationFacade } from "./migration/legacy-facade.js";

export { PolarisNode, DocumentNode, ElementNode, TextNode, CommentNode, matchesSelector } from "./renderer/document-model.js";
export { HTMLParser, parseHTML } from "./renderer/html-parser.js";
export { parseCSS, parseDeclarations, selectorSpecificity } from "./renderer/css-parser.js";
export { StyleEngine } from "./renderer/style-engine.js";
export { LayoutEngine } from "./renderer/layout-engine.js";
export { PaintEngine } from "./renderer/paint-engine.js";
export { PolarisRenderer } from "./renderer/renderer.js";

export { ResourceLoader, ResourceLoadError } from "./renderer/resource-loader.js";

export { PolarisEvent, PolarisCustomEvent, EventTargetMixin, dispatchPolarisEvent } from "./renderer/dom-events.js";
export { PolarisDocumentRuntime, PolarisMutationObserver } from "./renderer/dom-runtime.js";
export { PolarisHistory } from "./renderer/history-runtime.js";
export { collectFormData, encodeFormData } from "./renderer/forms.js";
export { ImageResourceLoader } from "./renderer/image-loader.js";
export { buildAccessibilityTree } from "./renderer/accessibility.js";
export { RendererViewport } from "./renderer/viewport.js";
export { PolarisScriptBridge } from "./renderer/script-bridge.js";

export { createStyleDeclaration } from "./renderer/style-declaration.js";
export { RendererNetworkPolicy } from "./renderer/network-policy.js";
export { RENDERER_CAPABILITIES, getRendererCapabilities, supportsRendererFeature } from "./renderer/runtime-capabilities.js";

export { ScriptRuntime } from "./renderer/script-runtime.js";

export { WorkerEngineAdapter } from "./renderer/worker-engine-adapter.js";

export { installPolarisScriptWorker } from "./renderer/script-worker-host.js";

export { PolarisDOMBridge } from "./renderer/script-bridge-extended.js";

export { PolarisFrameCompatibility } from "./renderer/frame-compatibility.js";

export { PolarisDOMBridge } from "./renderer/script-bridge-extended.js";
