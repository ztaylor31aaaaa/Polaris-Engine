import { EventBus } from "../utils/events.js";

/**
 * Coordinates an explicitly selected transport provider.
 * Providers are supplied by the host application; the engine ships no proxy.
 */
export class TransportProviderManager {
  constructor({ providers = [], selected = null, enabled = false, autoInitialise = false, connectTimeout = 15000, context = {} } = {}) {
    if (!Number.isInteger(connectTimeout) || connectTimeout < 1000 || connectTimeout > 120000) throw new RangeError("Connect timeout must be between 1000 and 120000 ms.");
    this.providers = new Map();
    this.selected = selected;
    this.enabled = Boolean(enabled);
    this.autoInitialise = Boolean(autoInitialise);
    this.connectTimeout = connectTimeout;
    this.context = context;
    this.state = this.enabled ? "idle" : "disabled";
    this.activeProvider = null;
    this.events = new EventBus();
    for (const provider of providers) this.register(provider);
  }
  register(provider) {
    if (!provider || typeof provider.id !== "string" || !/^[a-z0-9._-]{1,64}$/i.test(provider.id)) throw new TypeError("Provider needs a valid id.");
    if (this.providers.has(provider.id)) throw new Error("Provider already registered: " + provider.id);
    if (typeof provider.initialize !== "function") throw new TypeError("Provider must implement initialize(context).");
    this.providers.set(provider.id, provider);
    this.events.emit("transport:provider-registered", { id: provider.id, name: provider.name || provider.id });
    return provider;
  }
  list() { return [...this.providers.values()].map(({ id, name, version, capabilities = [] }) => ({ id, name: name || id, version: version || null, capabilities: [...capabilities] })); }
  status() { return { enabled: this.enabled, selected: this.selected, state: this.state, provider: this.activeProvider?.id || null, connectTimeout: this.connectTimeout }; }
  async configure({ enabled = this.enabled, selected = this.selected, autoInitialise = this.autoInitialise, connectTimeout = this.connectTimeout } = {}) {
    if (this.state === "disposed") throw new Error("Transport manager is disposed.");
    if (selected != null && !this.providers.has(selected)) throw new Error("Unknown transport provider: " + selected);
    if (!Number.isInteger(connectTimeout) || connectTimeout < 1000 || connectTimeout > 120000) throw new RangeError("Connect timeout must be between 1000 and 120000 ms.");
    if (!enabled || (this.activeProvider && selected !== this.selected)) await this.disable();
    this.selected = selected;
    this.enabled = Boolean(enabled);
    this.autoInitialise = Boolean(autoInitialise);
    this.connectTimeout = connectTimeout;
    if (this.enabled) this.state = "idle";
    this.events.emit("transport:configuration", this.status());
    if (this.enabled && this.autoInitialise) await this.initialise();
    return this.status();
  }
  async initialise() {
    if (!this.enabled) throw new Error("Transport is disabled. Enable it explicitly before initialising.");
    if (!this.selected) throw new Error("Select a transport provider first.");
    if (this.activeProvider) return this.status();
    const provider = this.providers.get(this.selected);
    if (!provider) throw new Error("Selected provider is not registered.");
    this.state = "initialising";
    this.events.emit("transport:state", this.status());
    try {
      await provider.initialize({ ...this.context, emit: (type, data) => this.events.emit(type, data) });
      this.activeProvider = provider;
      this.state = "ready";
      this.events.emit("transport:ready", this.status());
      return this.status();
    } catch (error) {
      this.state = "error";
      this.events.emit("transport:error", { stage: "initialise", provider: provider.id, code: error?.code || "PROVIDER_INITIALISE_FAILED", message: error?.message || "Provider initialisation failed." });
      throw error;
    }
  }
  async connect(options = {}) {
    if (!this.enabled) throw new Error("Transport is disabled.");
    if (!this.activeProvider) await this.initialise();
    if (typeof this.activeProvider.connect !== "function") throw new Error("Selected provider does not support connect().");
    this.state = "connecting";
    this.events.emit("transport:state", this.status());
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error("Transport connection timed out.");
        error.code = "PROVIDER_TIMEOUT";
        reject(error);
        controller.abort();
      }, this.connectTimeout);
    });
    try {
      const result = await Promise.race([
        Promise.resolve(this.activeProvider.connect({ ...options, signal: controller.signal })),
        timeout
      ]);
      this.state = "connected";
      this.events.emit("transport:connected", result);
      return result;
    } catch (error) {
      this.state = "error";
      this.events.emit("transport:error", { stage: "connect", provider: this.selected, code: error?.code || "PROVIDER_CONNECT_FAILED", message: error?.message || "Provider connection failed." });
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  async disable() {
    const provider = this.activeProvider;
    this.activeProvider = null;
    this.enabled = false;
    this.state = "disabled";
    try { await provider?.disconnect?.(); } finally { await provider?.dispose?.(); }
    this.events.emit("transport:state", this.status());
    return this.status();
  }
  async dispose() {
    if (this.state === "disposed") return;
    await this.disable();
    this.state = "disposed";
    this.events.clear();
  }
}
