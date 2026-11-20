const WEB_PROTOCOLS = new Set(["http:", "https:"]);
export class ViewAdapter {
  constructor({ container, createFrame } = {}) {
    this.container = container || null;
    this.createFrame = createFrame || (() => document.createElement("iframe"));
    this.frames = new Map();
  }
  async mount({ tabId, url, title = "Page" }) {
    const target = new URL(url);
    if (!WEB_PROTOCOLS.has(target.protocol)) throw new TypeError("Only HTTP(S) documents can be mounted.");
    if (!this.container) throw new Error("A view container is required.");
    await this.unmount({ tabId });
    const frame = this.createFrame();
    frame.title = title;
    frame.dataset.polarisTab = tabId;
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.loading = "eager";
    frame.src = target.href;
    this.container.append(frame);
    this.frames.set(tabId, frame);
    return frame;
  }
  async unmount({ tabId }) {
    const frame = this.frames.get(tabId);
    if (!frame) return false;
    frame.src = "about:blank";
    frame.remove();
    this.frames.delete(tabId);
    return true;
  }
  async stop({ tabId }) { return this.unmount({ tabId }); }
  getFrame(tabId) { return this.frames.get(tabId) || null; }
  dispose() { for (const id of this.frames.keys()) this.unmount({ tabId: id }); }
}
