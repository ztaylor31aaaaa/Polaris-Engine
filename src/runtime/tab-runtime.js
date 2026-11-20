import { EventBus } from "../utils/events.js";
import { DisposableStack, createAbortScope } from "./disposable.js";

export class TabRuntime {
  constructor({ tabId, adapter, parentSignal } = {}) {
    if (!tabId) throw new TypeError("tabId is required.");
    this.tabId = tabId;
    this.adapter = adapter || null;
    this.abortController = createAbortScope(parentSignal);
    this.resources = new DisposableStack();
    this.events = new EventBus();
    this.state = "created";
    this.startedAt = null;
  }
  async start(context = {}) {
    if (this.state !== "created") throw new Error("A stopped runtime cannot be restarted; create a new runtime instead.");
    this.state = "starting";
    this.events.emit("runtime:starting", { tabId: this.tabId });
    try {
      await this.adapter?.start?.({ tabId: this.tabId, signal: this.abortController.signal, ...context });
      this.startedAt = Date.now();
      this.state = "running";
      this.events.emit("runtime:started", { tabId: this.tabId, startedAt: this.startedAt });
      return this;
    } catch (error) {
      this.state = "failed";
      this.events.emit("runtime:error", { tabId: this.tabId, error });
      throw error;
    }
  }
  async suspend() {
    if (this.state !== "running") return false;
    await this.adapter?.suspend?.({ tabId: this.tabId });
    this.state = "suspended";
    this.events.emit("runtime:suspended", { tabId: this.tabId });
    return true;
  }
  async resume() {
    if (this.state !== "suspended") return false;
    await this.adapter?.resume?.({ tabId: this.tabId });
    this.state = "running";
    this.events.emit("runtime:resumed", { tabId: this.tabId });
    return true;
  }
  async stop(reason = "closed") {
    if (this.state === "stopped") return;
    this.abortController.abort(reason);
    this.state = "stopping";
    const errors = [];
    try { await this.adapter?.stop?.({ tabId: this.tabId, reason }); } catch (e) { errors.push(e); }
    try { await this.resources.dispose(); } catch (e) { errors.push(e); }
    this.state = "stopped";
    this.events.emit("runtime:stopped", { tabId: this.tabId, reason, errors });
    this.events.clear();
    if (errors.length) throw new AggregateError(errors, "Runtime shutdown was incomplete.");
  }
}
