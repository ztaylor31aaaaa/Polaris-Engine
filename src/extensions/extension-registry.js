import { EventBus } from "../utils/events.js";

export class ExtensionRegistry {
  constructor({ maxExtensions = 50 } = {}) {
    this.maxExtensions = maxExtensions;
    this.extensions = new Map();
    this.events = new EventBus();
  }
  register(extension) {
    if (!extension || typeof extension.id !== "string" || !/^[a-z0-9][a-z0-9._-]{1,63}$/i.test(extension.id)) throw new TypeError("Extension requires a valid id.");
    if (this.extensions.has(extension.id)) throw new Error("Extension already registered: " + extension.id);
    if (this.extensions.size >= this.maxExtensions) throw new RangeError("Extension limit reached.");
    if (typeof extension.activate !== "function") throw new TypeError("Extension must provide activate(context).");
    const record = { id: extension.id, name: String(extension.name || extension.id), version: String(extension.version || "0.0.0"), enabled: false, instance: extension };
    this.extensions.set(record.id, record);
    this.events.emit("extension:register", record);
    return record;
  }
  async enable(id, context = {}) {
    const record = this.extensions.get(id);
    if (!record) throw new Error("Extension not found: " + id);
    if (record.enabled) return record;
    record.cleanup = await record.instance.activate(context);
    record.enabled = true;
    this.events.emit("extension:enable", record);
    return record;
  }
  async disable(id) {
    const record = this.extensions.get(id);
    if (!record || !record.enabled) return false;
    if (typeof record.cleanup === "function") await record.cleanup();
    record.cleanup = null;
    record.enabled = false;
    this.events.emit("extension:disable", record);
    return true;
  }
  async unregister(id) {
    await this.disable(id);
    const removed = this.extensions.delete(id);
    if (removed) this.events.emit("extension:unregister", { id });
    return removed;
  }
  list() { return [...this.extensions.values()].map(({ id, name, version, enabled }) => ({ id, name, version, enabled })); }
}
