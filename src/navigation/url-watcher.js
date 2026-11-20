export class UrlWatcher {
  constructor(target = globalThis.window) {
    this.target = target;
    this.listeners = new Set();
    this.lastUrl = this.#read();
    this.active = false;
    this._check = () => this.check();
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
  start() {
    if (this.active || !this.target?.addEventListener) return this;
    this.active = true;
    this.target.addEventListener("popstate", this._check);
    this.target.addEventListener("hashchange", this._check);
    this.target.addEventListener("pageshow", this._check);
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
    this.active = false;
    this.listeners.clear();
  }
}
