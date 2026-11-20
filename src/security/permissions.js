import { EventBus } from "../utils/events.js";

const VALID = new Set(["clipboard-read", "clipboard-write", "notifications", "fullscreen", "media", "downloads", "geolocation"]);
export class PermissionManager {
  constructor({ defaults = [] } = {}) {
    this.grants = new Map();
    this.events = new EventBus();
    for (const permission of defaults) this.grant("global", permission);
  }
  #key(scope, permission) { return String(scope) + ":" + permission; }
  grant(scope, permission) {
    if (!VALID.has(permission)) throw new TypeError("Unknown permission: " + permission);
    this.grants.set(this.#key(scope, permission), true);
    this.events.emit("permission:granted", { scope, permission });
    return true;
  }
  revoke(scope, permission) {
    const changed = this.grants.delete(this.#key(scope, permission));
    if (changed) this.events.emit("permission:revoked", { scope, permission });
    return changed;
  }
  has(scope, permission) {
    return this.grants.has(this.#key(scope, permission)) || this.grants.has(this.#key("global", permission));
  }
  require(scope, permission) {
    if (!this.has(scope, permission)) throw new Error("Permission required: " + permission);
    return true;
  }
  clearScope(scope) {
    for (const key of this.grants.keys()) if (key.startsWith(String(scope) + ":")) this.grants.delete(key);
  }
  list(scope) {
    return [...this.grants.keys()].filter(key => key.startsWith(String(scope) + ":") || key.startsWith("global:")).map(key => key.slice(key.indexOf(":") + 1));
  }
}
