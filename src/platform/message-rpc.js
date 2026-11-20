export class MessageRPC {
  constructor(port, { timeout = 10000 } = {}) {
    if (!port?.postMessage) throw new TypeError("A MessagePort-like object is required.");
    this.port = port;
    this.timeout = timeout;
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
    this.closed = false;
    this._onMessage = event => this.#receive(event.data);
    if (port.addEventListener) { port.addEventListener("message", this._onMessage); port.start?.(); }
    else port.onmessage = this._onMessage;
  }
  handle(method, callback) {
    if (typeof callback !== "function") throw new TypeError("RPC handler must be a function.");
    this.handlers.set(method, callback);
    return () => this.handlers.delete(method);
  }
  call(method, params, { timeout = this.timeout, transfer = [] } = {}) {
    if (this.closed) return Promise.reject(new Error("RPC connection is closed."));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = timeout > 0 ? setTimeout(() => { this.pending.delete(id); reject(new Error("RPC timed out: " + method)); }, timeout) : null;
      this.pending.set(id, { resolve, reject, timer });
      try { this.port.postMessage({ rpc: 1, type: "request", id, method, params }, transfer); }
      catch (error) { if (timer) clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }
  async #receive(message) {
    if (!message || message.rpc !== 1) return;
    if (message.type === "response") {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (pending.timer) clearTimeout(pending.timer);
      message.error ? pending.reject(new Error(message.error)) : pending.resolve(message.result);
      return;
    }
    if (message.type === "request") {
      const handler = this.handlers.get(message.method);
      try {
        if (!handler) throw new Error("Unknown RPC method: " + message.method);
        const result = await handler(message.params);
        this.port.postMessage({ rpc: 1, type: "response", id: message.id, result });
      } catch (error) {
        this.port.postMessage({ rpc: 1, type: "response", id: message.id, error: String(error?.message || error) });
      }
    }
  }
  close(reason = "RPC connection closed") {
    if (this.closed) return;
    this.closed = true;
    for (const pending of this.pending.values()) {
      if (pending.timer) clearTimeout(pending.timer);
      pending.reject(new Error(reason));
    }
    this.pending.clear();
    this.handlers.clear();
    this.port.removeEventListener?.("message", this._onMessage);
    this.port.close?.();
  }
}
