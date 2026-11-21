import { EventBus } from "../utils/events.js";

export class ClipboardAdapter {
  constructor({ clipboard = globalThis.navigator?.clipboard } = {}) {
    if (!clipboard) throw new Error("The Clipboard API is not available.");
    this.clipboard = clipboard;
  }
  async readText() { return this.clipboard.readText(); }
  async writeText(value) {
    if (typeof value !== "string") throw new TypeError("Clipboard text must be a string.");
    await this.clipboard.writeText(value);
    return true;
  }
}

export class FullscreenAdapter {
  constructor({ documentRef = globalThis.document } = {}) {
    if (!documentRef) throw new Error("A document is required.");
    this.document = documentRef;
    this.events = new EventBus();
    this.onChange = () => this.events.emit("fullscreen:change", this.getState());
    this.onError = event => this.events.emit("fullscreen:error", event);
    documentRef.addEventListener("fullscreenchange", this.onChange);
    documentRef.addEventListener("fullscreenerror", this.onError);
    this.disposed = false;
  }
  on(type, listener) { return this.events.on(type, listener); }
  getState() {
    const element = this.document.fullscreenElement || null;
    return { active: Boolean(element), element };
  }
  async enter(element) {
    if (this.disposed) throw new Error("FullscreenAdapter has been disposed.");
    if (!element?.requestFullscreen) throw new Error("The target does not support fullscreen.");
    await element.requestFullscreen();
    return this.getState();
  }
  async exit() {
    if (this.disposed) throw new Error("FullscreenAdapter has been disposed.");
    if (this.document.fullscreenElement) await this.document.exitFullscreen();
    return this.getState();
  }
  async toggle(element) {
    return this.document.fullscreenElement ? this.exit() : this.enter(element);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.document.removeEventListener("fullscreenchange", this.onChange);
    this.document.removeEventListener("fullscreenerror", this.onError);
    this.events.clear();
  }
}

export class VisibilityAdapter {
  constructor({ documentRef = globalThis.document } = {}) {
    if (!documentRef) throw new Error("A document is required.");
    this.document = documentRef;
    this.events = new EventBus();
    this.listener = () => this.events.emit("visibility:change", this.getState());
    documentRef.addEventListener("visibilitychange", this.listener);
    this.disposed = false;
  }
  on(type, listener) { return this.events.on(type, listener); }
  getState() {
    return { state: this.document.visibilityState || (this.document.hidden ? "hidden" : "visible"), hidden: Boolean(this.document.hidden) };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.document.removeEventListener("visibilitychange", this.listener);
    this.events.clear();
  }
}

export class ConnectivityAdapter {
  constructor({ navigatorRef = globalThis.navigator, windowRef = globalThis.window } = {}) {
    if (!navigatorRef || !windowRef) throw new Error("Navigator and window are required.");
    this.navigator = navigatorRef;
    this.window = windowRef;
    this.events = new EventBus();
    this.online = () => this.events.emit("connectivity:change", this.getState());
    this.offline = () => this.events.emit("connectivity:change", this.getState());
    windowRef.addEventListener("online", this.online);
    windowRef.addEventListener("offline", this.offline);
    this.disposed = false;
  }
  on(type, listener) { return this.events.on(type, listener); }
  getState() { return { online: this.navigator.onLine !== false, connection: this.navigator.connection ? { effectiveType: this.navigator.connection.effectiveType, downlink: this.navigator.connection.downlink, rtt: this.navigator.connection.rtt, saveData: this.navigator.connection.saveData } : null }; }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.window.removeEventListener("online", this.online);
    this.window.removeEventListener("offline", this.offline);
    this.events.clear();
  }
}

export class MediaQueryAdapter {
  constructor(query, { matchMediaImpl = globalThis.matchMedia } = {}) {
    if (typeof query !== "string" || !query.trim()) throw new TypeError("A media query is required.");
    if (typeof matchMediaImpl !== "function") throw new Error("matchMedia is not available.");
    this.query = query;
    this.media = matchMediaImpl(query);
    this.events = new EventBus();
    this.listener = event => this.events.emit("media:change", { matches: event.matches, media: event.media });
    this.media.addEventListener?.("change", this.listener);
    this.disposed = false;
  }
  on(type, listener) { return this.events.on(type, listener); }
  getState() { return { matches: this.media.matches, media: this.media.media }; }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.media.removeEventListener?.("change", this.listener);
    this.events.clear();
  }
}
