import { EventBus } from "../utils/events.js";
import { JsonStore } from "../storage/stores.js";

const DEFAULTS = Object.freeze({
  homepage: "about:blank",
  searchTemplate: "https://www.google.com/search?q=%s",
  restoreSession: true,
  confirmCloseMultipleTabs: true,
  reduceMotion: false,
  theme: "system",
  zoom: 1,
  language: "en",
  downloadsAskLocation: true,
  transportEnabled: false,
  transportProvider: "",
  transportAutoInitialise: false,
  transportConnectTimeout: 15000,
  transportDebug: false
});
export class SettingsManager {
  constructor({ storage, key = "polaris-engine-settings", defaults = {} } = {}) {
    this.store = new JsonStore({ storage, key });
    this.defaults = { ...DEFAULTS, ...defaults };
    this.values = { ...this.defaults, ...this.store.read({}) };
    this.events = new EventBus();
    this.#validateAll();
  }
  #validate(key, value) {
    if (!(key in this.defaults)) throw new TypeError("Unknown setting: " + key);
    if (key === "theme" && !["system", "light", "dark"].includes(value)) throw new TypeError("Invalid theme.");
    if (key === "zoom" && (typeof value !== "number" || value < 0.5 || value > 2)) throw new RangeError("Zoom must be between 0.5 and 2.");
    if (key === "transportProvider" && (typeof value !== "string" || (value && !/^[a-z0-9._-]{1,64}$/i.test(value)))) throw new TypeError("Invalid transport provider id.");
    if (key === "transportConnectTimeout" && (!Number.isInteger(value) || value < 1000 || value > 120000)) throw new RangeError("Transport timeout must be between 1000 and 120000 ms.");
    if (typeof this.defaults[key] === "boolean" && typeof value !== "boolean") throw new TypeError(key + " must be boolean.");
    if (typeof this.defaults[key] === "string" && typeof value !== "string") throw new TypeError(key + " must be a string.");
    return value;
  }
  #validateAll() {
    for (const [key, value] of Object.entries(this.values)) {
      try { this.#validate(key, value); } catch { delete this.values[key]; }
    }
  }
  get(key) { return this.values[key]; }
  all() { return { ...this.values }; }
  set(key, value) {
    this.#validate(key, value);
    const previous = this.values[key];
    if (Object.is(previous, value)) return value;
    this.values[key] = value;
    this.store.write(this.values);
    this.events.emit("settings:change", { key, value, previous });
    return value;
  }
  setMany(values) {
    const next = { ...this.values };
    for (const [key, value] of Object.entries(values)) {
      if (!(key in this.defaults)) throw new TypeError("Unknown setting: " + key);
      this.#validate(key, value);
      next[key] = value;
    }
    const previous = this.values;
    this.values = next;
    this.store.write(this.values);
    this.events.emit("settings:batch-change", { values: this.all(), previous: { ...previous } });
    return this.all();
  }
  reset(key) {
    if (key) return this.set(key, this.defaults[key]);
    this.values = { ...this.defaults };
    this.store.write(this.values);
    this.events.emit("settings:reset", this.all());
    return this.all();
  }
}
