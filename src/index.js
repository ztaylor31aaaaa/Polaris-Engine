export { EventBus } from "./utils/events.js";
export { resolveAddress, isWebAddress } from "./navigation/url-resolver.js";
export { NavigationController } from "./navigation/controller.js";
export { TabManager } from "./tabs/tab-manager.js";
export { JsonStore, BookmarkStore, HistoryStore } from "./storage/stores.js";
export { runDiagnostics } from "./diagnostics/index.js";

export const ENGINE_NAME = "Polaris Engine";
export const ENGINE_VERSION = "0.1.0";
