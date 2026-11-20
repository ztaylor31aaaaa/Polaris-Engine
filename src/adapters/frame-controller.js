import { EventBus } from "../utils/events.js";

export class FrameController {
  constructor({ container, createFrame, sandbox = "allow-forms allow-scripts allow-same-origin" } = {}) {
    this.container = container || null;
    this.createFrame = createFrame || (() => document.createElement("iframe"));
    this.sandbox = sandbox;
    this.frames = new Map();
    this.events = new EventBus();
  }
  create(id, { url = "about:blank", title = "Polaris view", allow = "" } = {}) {
    if (!this.container) throw new Error("Frame container is required.");
    if (this.frames.has(id)) throw new Error("Frame already exists: " + id);
    const frame = this.createFrame();
    frame.title = title;
    frame.dataset.polarisFrame = String(id);
    frame.setAttribute("sandbox", this.sandbox);
    if (allow) frame.setAttribute("allow", allow);
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.addEventListener("load", () => this.events.emit("frame:load", { id, frame }));
    frame.addEventListener("error", error => this.events.emit("frame:error", { id, error }));
    this.container.append(frame);
    this.frames.set(id, frame);
    if (url !== "about:blank") this.navigate(id, url);
    this.events.emit("frame:create", { id, frame });
    return frame;
  }
  navigate(id, input) {
    const frame = this.get(id);
    if (!frame) throw new Error("Frame not found: " + id);
    const url = new URL(input);
    if (!["http:", "https:", "about:"].includes(url.protocol)) throw new TypeError("Unsupported frame URL protocol.");
    frame.src = url.href;
    this.events.emit("frame:navigate", { id, url: url.href });
    return url.href;
  }
  get(id) { return this.frames.get(id) || null; }
  inspect(id) {
    const frame = this.get(id);
    if (!frame) return null;
    let currentUrl = null;
    try { currentUrl = frame.contentWindow?.location?.href || null; } catch { currentUrl = frame.src; }
    return { id, title: frame.title, src: frame.src, currentUrl, connected: frame.isConnected };
  }
  postMessage(id, message, targetOrigin) {
    const frame = this.get(id);
    if (!frame?.contentWindow) throw new Error("Frame is not ready.");
    if (!targetOrigin || targetOrigin === "*") throw new TypeError("An explicit target origin is required.");
    frame.contentWindow.postMessage(message, targetOrigin);
  }
  close(id) {
    const frame = this.get(id);
    if (!frame) return false;
    frame.src = "about:blank";
    frame.remove();
    this.frames.delete(id);
    this.events.emit("frame:close", { id });
    return true;
  }
  closeAll() { for (const id of [...this.frames.keys()]) this.close(id); }
}
