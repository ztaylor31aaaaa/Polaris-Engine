export class UrlWatcher {
  constructor(target = globalThis.window) {
    this.target = target;
    this.listeners = new Set();
    this.lastUrl = this.#read();
    this.active = false;
    this._check = () => this.check();
    this._historyRestorers = [];
  }
  #read() { try { return this.target?.location?.href || ""; } catch { return ""; } }
  check() {
    const next = this.#read();
    if (next === this.lastUrl) return false;
    const previous = this.lastUrl;
    this.lastUrl = next;
    for (const listener of [...this.listeners]) listener({ url: next, previous });
    return true;
  }
  #wrapHistory(method) {
    const history = this.target?.history;
    const original = history?.[method];
    if (typeof original !== "function") return;
    const watcher = this;
    function wrapped(...args) {
      const result = original.apply(this, args);
      queueMicrotask(() => watcher.check());
      return result;
    }
    history[method] = wrapped;
    this._historyRestorers.push(() => {
      if (history[method] === wrapped) history[method] = original;
    });
  }
  start() {
    if (this.active || !this.target?.addEventListener) return this;
    this.active = true;
    this.target.addEventListener("popstate", this._check);
    this.target.addEventListener("hashchange", this._check);
    this.target.addEventListener("pageshow", this._check);
    this.#wrapHistory("pushState");
    this.#wrapHistory("replaceState");
    return this;
  }
  subscribe(listener) {
    if (typeof listener !== "function") throw new TypeError("Listener must be a function.");
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  stop() {
    if (this.active) {
      this.target.removeEventListener("popstate", this._check);
      this.target.removeEventListener("hashchange", this._check);
      this.target.removeEventListener("pageshow", this._check);
    }
    for (const restore of this._historyRestorers.splice(0)) restore();
    this.active = false;
    this.listeners.clear();
  }
}
