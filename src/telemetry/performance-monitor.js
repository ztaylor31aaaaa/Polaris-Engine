import { EventBus } from "../utils/events.js";

export class PerformanceMonitor {
  constructor({ limit = 300 } = {}) { this.limit = limit; this.samples = []; this.events = new EventBus(); }
  record(name, value, metadata = {}) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new TypeError("Metric value must be a non-negative finite number.");
    const sample = { name: String(name), value, metadata: { ...metadata }, timestamp: Date.now() };
    this.samples.push(sample);
    if (this.samples.length > this.limit) this.samples.splice(0, this.samples.length - this.limit);
    this.events.emit("metric", sample);
    return sample;
  }
  measure(name, callback, metadata = {}) {
    const start = globalThis.performance?.now?.() ?? Date.now();
    try {
      const result = callback();
      if (result && typeof result.then === "function") return result.finally(() => this.record(name, (globalThis.performance?.now?.() ?? Date.now()) - start, metadata));
      this.record(name, (globalThis.performance?.now?.() ?? Date.now()) - start, metadata);
      return result;
    } catch (error) {
      this.record(name, (globalThis.performance?.now?.() ?? Date.now()) - start, { ...metadata, failed: true });
      throw error;
    }
  }
  summary(name) {
    const values = this.samples.filter(sample => !name || sample.name === name).map(sample => sample.value).sort((a,b) => a-b);
    if (!values.length) return null;
    const sum = values.reduce((a,b) => a+b, 0);
    return { count: values.length, min: values[0], max: values.at(-1), average: sum / values.length, p95: values[Math.min(values.length - 1, Math.ceil(values.length * .95) - 1)] };
  }
  list() { return this.samples.map(sample => ({ ...sample, metadata: { ...sample.metadata } })); }
  clear() { this.samples = []; }
}
