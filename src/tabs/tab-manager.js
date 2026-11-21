import { EventBus } from "../utils/events.js";

const makeId = () => globalThis.crypto?.randomUUID?.() ||
  "tab-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);

export class TabManager {
  constructor({ maxTabs = 40 } = {}) {
    this.maxTabs = maxTabs;
    this.tabs = [];
    this.activeId = null;
    this.closed = [];
    this.events = new EventBus();
  }

  get active() { return this.tabs.find(tab => tab.id === this.activeId) || null; }

  create({ title = "New tab", url = "", pinned = false, group = "" } = {}) {
    if (this.tabs.length >= this.maxTabs) throw new RangeError("The tab limit has been reached.");
    const tab = { id: makeId(), title, url, pinned: Boolean(pinned), group, createdAt: Date.now(), state: "idle" };
    this.tabs.push(tab);
    this.activeId = tab.id;
    this.events.emit("tab:create", tab);
    this.events.emit("tab:activate", tab);
    return tab;
  }

  activate(id) {
    const tab = this.tabs.find(item => item.id === id);
    if (!tab) return null;
    this.activeId = id;
    this.events.emit("tab:activate", tab);
    return tab;
  }

  update(id, patch) {
    const tab = this.tabs.find(item => item.id === id);
    if (!tab) return null;
    Object.assign(tab, patch, { id: tab.id });
    this.events.emit("tab:update", tab);
    return tab;
  }

  close(id = this.activeId) {
    const index = this.tabs.findIndex(tab => tab.id === id);
    if (index < 0) return null;
    const [tab] = this.tabs.splice(index, 1);
    this.closed.push({ ...tab });
    this.closed = this.closed.slice(-10);
    if (this.activeId === id) this.activeId = this.tabs[Math.max(0, index - 1)]?.id || null;
    this.events.emit("tab:close", { tab, active: this.active });
    return tab;
  }

  reopen() {
    const previous = this.closed.pop();
    if (!previous || this.tabs.length >= this.maxTabs) return null;
    const restored = { ...previous, id: makeId(), state: "idle" };
    this.tabs.push(restored);
    this.activeId = restored.id;
    this.events.emit("tab:reopen", restored);
    return restored;
  }

  serialise() {
    return { schema: 1, activeId: this.activeId, tabs: this.tabs.map(({ id, title, url, pinned, group }) => ({ id, title, url, pinned, group })) };
  }

  restore(data) {
    if (!data || data.schema !== 1 || !Array.isArray(data.tabs)) throw new TypeError("Unsupported tab session format.");
    const restoredIds = new Map();
    const tabs = data.tabs.slice(0, this.maxTabs).map(item => {
      if (typeof item.title !== "string" || typeof item.url !== "string") throw new TypeError("Invalid tab entry.");
      const id = makeId();
      if (typeof item.id === "string") restoredIds.set(item.id, id);
      return { id, title: item.title.slice(0, 120), url: item.url, pinned: Boolean(item.pinned), group: String(item.group || "").slice(0, 40), createdAt: Date.now(), state: "idle" };
    });
    this.tabs = tabs;
    this.activeId = restoredIds.get(data.activeId) || tabs[0]?.id || null;
    this.events.emit("session:restore", this.serialise());
    return this.tabs;
  }
}
