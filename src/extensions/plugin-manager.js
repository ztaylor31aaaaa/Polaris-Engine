import { EventBus } from "../utils/events.js";

export class PluginManager {
  constructor({ context = {}, maxPlugins = 100 } = {}) {
    this.context = context;
    this.maxPlugins = maxPlugins;
    this.plugins = new Map();
    this.events = new EventBus();
  }
  register(plugin) {
    if (!plugin || typeof plugin.name !== "string" || !plugin.name.trim()) throw new TypeError("Plugin requires a name.");
    if (this.plugins.has(plugin.name)) throw new Error("Plugin already registered: " + plugin.name);
    if (this.plugins.size >= this.maxPlugins) throw new RangeError("Plugin limit reached.");
    if (typeof plugin.setup !== "function") throw new TypeError("Plugin must implement setup(context).");
    const record = { name: plugin.name, version: String(plugin.version || "0.0.0"), dependencies: [...(plugin.dependencies || [])], plugin, active: false, cleanup: null };
    this.plugins.set(record.name, record);
    this.events.emit("plugin:register", { name: record.name, version: record.version });
    return record;
  }
  #order(name, visited = new Set(), stack = new Set(), result = []) {
    if (visited.has(name)) return result;
    if (stack.has(name)) throw new Error("Plugin dependency cycle detected at " + name);
    const record = this.plugins.get(name);
    if (!record) throw new Error("Missing plugin dependency: " + name);
    stack.add(name);
    for (const dependency of record.dependencies) this.#order(dependency, visited, stack, result);
    stack.delete(name);
    visited.add(name);
    result.push(record);
    return result;
  }
  async enable(name) {
    const ordered = this.#order(name);
    for (const record of ordered) {
      if (record.active) continue;
      record.cleanup = await record.plugin.setup({ ...this.context, plugins: this });
      record.active = true;
      this.events.emit("plugin:enable", { name: record.name });
    }
    return this.plugins.get(name);
  }
  async disable(name) {
    const record = this.plugins.get(name);
    if (!record?.active) return false;
    const dependents = [...this.plugins.values()].filter(item => item.active && item.dependencies.includes(name));
    for (const dependent of dependents) await this.disable(dependent.name);
    if (typeof record.cleanup === "function") await record.cleanup();
    record.cleanup = null;
    record.active = false;
    this.events.emit("plugin:disable", { name });
    return true;
  }
  async remove(name) {
    await this.disable(name);
    const removed = this.plugins.delete(name);
    if (removed) this.events.emit("plugin:remove", { name });
    return removed;
  }
  list() { return [...this.plugins.values()].map(({ name, version, dependencies, active }) => ({ name, version, dependencies: [...dependencies], active })); }
}
