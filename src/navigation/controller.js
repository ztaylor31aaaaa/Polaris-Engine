import { EventBus } from "../utils/events.js";
import { resolveAddress } from "./url-resolver.js";

export class NavigationController {
  constructor({ searchUrl, openDocument } = {}) {
    this.searchUrl = searchUrl;
    this.openDocument = openDocument || (url => { globalThis.location.href = url; });
    this.events = new EventBus();
    this.entries = [];
    this.index = -1;
    this.loading = false;
  }

  get current() { return this.entries[this.index] || null; }
  get canGoBack() { return this.index > 0; }
  get canGoForward() { return this.index >= 0 && this.index < this.entries.length - 1; }

  async navigate(input, { replace = false } = {}) {
    const url = resolveAddress(input, { searchUrl: this.searchUrl });
    const entry = { url, visitedAt: new Date().toISOString() };
    if (replace && this.index >= 0) this.entries[this.index] = entry;
    else {
      this.entries = this.entries.slice(0, this.index + 1);
      this.entries.push(entry);
      this.index = this.entries.length - 1;
    }
    this.events.emit("navigation:start", entry);
    this.loading = true;
    try {
      await this.openDocument(url);
      this.events.emit("navigation:commit", entry);
      return entry;
    } catch (error) {
      this.events.emit("navigation:error", { ...entry, error });
      throw error;
    } finally {
      this.loading = false;
      this.events.emit("navigation:finish", entry);
    }
  }

  async back() {
    if (!this.canGoBack) return null;
    this.index--;
    return this.#restore();
  }

  async forward() {
    if (!this.canGoForward) return null;
    this.index++;
    return this.#restore();
  }

  async reload() {
    if (!this.current) return null;
    this.events.emit("navigation:reload", this.current);
    return this.openDocument(this.current.url);
  }

  async #restore() {
    const entry = this.current;
    this.events.emit("navigation:restore", entry);
    await this.openDocument(entry.url);
    return entry;
  }
}
