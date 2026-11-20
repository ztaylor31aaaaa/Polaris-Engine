export { EventBus } from "./utils/events.js";
export { resolveAddress, isWebAddress } from "./navigation/url-resolver.js";
export { NavigationController } from "./navigation/controller.js";
export { TabManager } from "./tabs/tab-manager.js";
export { JsonStore, BookmarkStore, HistoryStore } from "./storage/stores.js";
export { runDiagnostics } from "./diagnostics/index.js";
export { DisposableStack, createAbortScope } from "./runtime/disposable.js";
export { TabRuntime } from "./runtime/tab-runtime.js";
export { RuntimeManager } from "./runtime/runtime-manager.js";
export { PermissionManager } from "./security/permissions.js";
export { OriginPolicy } from "./security/origin-policy.js";
export { SettingsManager } from "./settings/settings-manager.js";
export { ExtensionRegistry } from "./extensions/extension-registry.js";
export { CommandRegistry } from "./commands/command-registry.js";
export { PerformanceMonitor } from "./telemetry/performance-monitor.js";
export { ViewAdapter } from "./adapters/view-adapter.js";

export const ENGINE_NAME = "Polaris Engine";
export const ENGINE_VERSION = "0.2.0";
