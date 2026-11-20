export class EventBus {
  #listeners = new Map();

  on(type, listener) {
    if (typeof listener !== "function") throw new TypeError("Listener must be a function");
    const listeners = this.#listeners.get(type) || new Set();
    listeners.add(listener);
    this.#listeners.set(type, listeners);
    return () => this.off(type, listener);
  }

  once(type, listener) {
    const off = this.on(type, payload => { off(); listener(payload); });
    return off;
  }

  off(type, listener) {
    const listeners = this.#listeners.get(type);
    if (!listeners) return;
    listeners.delete(listener);
    if (!listeners.size) this.#listeners.delete(type);
  }

  emit(type, payload) {
    for (const listener of [...(this.#listeners.get(type) || [])]) {
      try { listener(payload); } catch (error) {
        queueMicrotask(() => { throw error; });
      }
    }
  }

  clear() { this.#listeners.clear(); }
}
