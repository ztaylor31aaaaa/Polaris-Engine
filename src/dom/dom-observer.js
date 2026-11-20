export class DOMObserver {
  constructor(root = globalThis.document) {
    if (!root) throw new Error("A DOM root is required.");
    this.root = root;
    this.observer = null;
    this.listeners = new Set();
  }
  observe({ childList = true, attributes = true, characterData = false, subtree = true, attributeFilter } = {}) {
    if (!globalThis.MutationObserver) throw new Error("MutationObserver is unavailable.");
    this.disconnect();
    this.observer = new MutationObserver(records => {
      for (const listener of [...this.listeners]) listener(records);
    });
    this.observer.observe(this.root, { childList, attributes, characterData, subtree, ...(attributeFilter ? { attributeFilter } : {}) });
    return this;
  }
  onChange(listener) {
    if (typeof listener !== "function") throw new TypeError("Listener must be a function.");
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  disconnect() {
    this.observer?.disconnect();
    this.observer = null;
  }
  dispose() { this.disconnect(); this.listeners.clear(); }
}
