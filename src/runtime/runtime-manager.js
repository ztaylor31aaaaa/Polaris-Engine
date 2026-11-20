import { EventBus } from "../utils/events.js";
import { TabRuntime } from "./tab-runtime.js";

export class RuntimeManager {
  constructor({ adapterFactory = () => null, maxRuntimes = 40 } = {}) {
    this.adapterFactory = adapterFactory;
    this.maxRuntimes = maxRuntimes;
    this.runtimes = new Map();
    this.events = new EventBus();
  }
  get(tabId) { return this.runtimes.get(tabId) || null; }
  async start(tabId, context = {}) {
    if (this.runtimes.has(tabId)) return this.runtimes.get(tabId);
    if (this.runtimes.size >= this.maxRuntimes) throw new RangeError("Runtime limit reached.");
    const runtime = new TabRuntime({ tabId, adapter: this.adapterFactory(tabId, context) });
    this.runtimes.set(tabId, runtime);
    runtime.events.on("runtime:stopped", event => {
      this.runtimes.delete(tabId);
      this.events.emit("runtime:stopped", event);
    });
    runtime.events.on("runtime:error", event => this.events.emit("runtime:error", event));
    try {
      await runtime.start(context);
      this.events.emit("runtime:started", { tabId, runtime });
      return runtime;
    } catch (error) {
      this.runtimes.delete(tabId);
      throw error;
    }
  }
  async stop(tabId, reason) {
    const runtime = this.get(tabId);
    if (!runtime) return false;
    await runtime.stop(reason);
    this.runtimes.delete(tabId);
    return true;
  }
  async stopAll(reason = "shutdown") {
    const results = await Promise.allSettled([...this.runtimes.keys()].map(id => this.stop(id, reason)));
    return results;
  }
  async suspendOthers(activeTabId) {
    return Promise.all([...this.runtimes].filter(([id]) => id !== activeTabId).map(([, runtime]) => runtime.suspend()));
  }
}
