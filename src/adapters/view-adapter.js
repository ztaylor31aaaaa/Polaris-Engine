import { EventBus } from "../utils/events.js";

const WEB_PROTOCOLS = new Set(["http:", "https:"]);
const DEFAULT_LOAD_TIMEOUT = 15000;

function safeError(error) {
  return {
    name: String(error?.name || "Error"),
    message: String(error?.message || error || "Unknown view error").slice(0, 500)
  };
}

export class ViewAdapter {
  constructor({ container, createFrame, loadTimeout = DEFAULT_LOAD_TIMEOUT, sandbox = "allow-forms allow-scripts" } = {}) {
    this.container = container || null;
    this.createFrame = createFrame || (() => document.createElement("iframe"));
    this.loadTimeout = Math.max(0, Number(loadTimeout) || 0);
    this.sandbox = sandbox;
    this.frames = new Map();
    this.events = new EventBus();
    this.states = new Map();
  }

  on(type, listener) { return this.events.on(type, listener); }

  #setState(tabId, state, details = {}) {
    const previous = this.states.get(tabId) || null;
    const next = { tabId, state, timestamp: Date.now(), ...details };
    this.states.set(tabId, next);
    this.events.emit("view:state", { ...next, previousState: previous?.state || null });
    if (state === "error" || state === "timeout") this.events.emit("view:error", next);
    return next;
  }

  async mount({ tabId, url, title = "Page" }) {
    if (tabId == null) throw new TypeError("tabId is required.");
    const target = new URL(url);
    if (!WEB_PROTOCOLS.has(target.protocol)) throw new TypeError("Only HTTP(S) documents can be mounted.");
    if (!this.container) throw new Error("A view container is required.");
    await this.unmount({ tabId });

    const frame = this.createFrame();
    const record = { frame, timer: null, onLoad: null, onError: null, url: target.href };
    frame.title = title;
    frame.dataset.polarisTab = String(tabId);
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.loading = "eager";
    frame.setAttribute?.("sandbox", this.sandbox);
    frame.addEventListener?.("load", record.onLoad = () => {
      if (this.frames.get(tabId) !== record) return;
      clearTimeout(record.timer);
      // iframe load does not prove the document succeeded; browsers intentionally hide
      // most cross-origin network and HTTP failure details from embedding pages.
      this.#setState(tabId, "load-observed", {
        url: record.url,
        detail: "The iframe fired load. HTTP status and cross-origin document errors are not exposed."
      });
    });
    frame.addEventListener?.("error", record.onError = error => {
      if (this.frames.get(tabId) !== record) return;
      clearTimeout(record.timer);
      this.#setState(tabId, "error", { url: record.url, stage: "frame", error: safeError(error) });
    });

    this.frames.set(tabId, record);
    this.#setState(tabId, "loading", { url: target.href });
    this.container.append(frame);
    frame.src = target.href;

    if (this.loadTimeout > 0) {
      record.timer = setTimeout(() => {
        if (this.frames.get(tabId) !== record) return;
        this.#setState(tabId, "timeout", {
          url: record.url,
          stage: "frame-load",
          error: { name: "TimeoutError", message: `No iframe load event was observed within ${this.loadTimeout}ms.` }
        });
      }, this.loadTimeout);
    }
    return frame;
  }

  reportError({ tabId, stage = "transport", code = "TRANSPORT_ERROR", message = "A host transport reported an error.", cause } = {}) {
    if (!this.frames.has(tabId)) return false;
    const error = { code: String(code).slice(0, 80), ...safeError(cause || new Error(message)) };
    this.#setState(tabId, "error", { url: this.frames.get(tabId).url, stage, error });
    return true;
  }

  getStatus(tabId) {
    const state = this.states.get(tabId);
    return state ? { ...state } : null;
  }

  async unmount({ tabId }) {
    const record = this.frames.get(tabId);
    if (!record) return false;
    clearTimeout(record.timer);
    record.frame.removeEventListener?.("load", record.onLoad);
    record.frame.removeEventListener?.("error", record.onError);
    record.frame.src = "about:blank";
    record.frame.remove();
    this.frames.delete(tabId);
    this.#setState(tabId, "unmounted", { url: record.url });
    return true;
  }

  async stop({ tabId }) { return this.unmount({ tabId }); }
  getFrame(tabId) { return this.frames.get(tabId)?.frame || null; }
  dispose() {
    for (const id of [...this.frames.keys()]) this.unmount({ tabId: id });
    this.events.clear();
  }
}
