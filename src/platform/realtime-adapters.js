import { EventBus } from "../utils/events.js";

function validateUrl(value, protocols) {
  const url = new URL(value);
  if (!protocols.has(url.protocol)) throw new TypeError(`Unsupported URL protocol: ${url.protocol}`);
  return url;
}

function makeAbortError() {
  return new DOMException("The operation was aborted.", "AbortError");
}

export class WebSocketAdapter {
  constructor({ WebSocketImpl = globalThis.WebSocket, connectionTimeout = 10000, allowedOrigins = null, maxBufferedAmount = 1024 * 1024 } = {}) {
    if (typeof WebSocketImpl !== "function") throw new Error("WebSocket is not available in this environment.");
    this.WebSocketImpl = WebSocketImpl;
    this.connectionTimeout = Math.max(0, Number(connectionTimeout) || 0);
    this.allowedOrigins = allowedOrigins ? new Set(allowedOrigins) : null;
    this.maxBufferedAmount = Math.max(0, Number(maxBufferedAmount) || 0);
    this.socket = null;
    this.events = new EventBus();
    this.disposed = false;
    this.cleanup = [];
  }

  on(type, listener) { return this.events.on(type, listener); }

  async connect(value, { protocols, signal } = {}) {
    if (this.disposed) throw new Error("WebSocketAdapter has been disposed.");
    if (this.socket && this.socket.readyState < this.WebSocketImpl.CLOSING) throw new Error("A WebSocket connection is already active.");
    const url = validateUrl(value, new Set(["ws:", "wss:"]));
    if (this.allowedOrigins && !this.allowedOrigins.has(url.origin)) throw new DOMException("WebSocket origin is not allowed.", "SecurityError");
    if (signal?.aborted) throw makeAbortError();

    const socket = new this.WebSocketImpl(url.href, protocols);
    this.socket = socket;
    this.events.emit("socket:connecting", { url: url.href });
    return new Promise((resolve, reject) => {
      let settled = false;
      let timer = null;
      const clean = () => {
        if (timer !== null) clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        socket.removeEventListener?.("open", opened);
        socket.removeEventListener?.("error", failed);
      };
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clean();
        fn(value);
      };
      const abort = () => {
        try { socket.close(1000, "Connection aborted"); } catch {}
        finish(reject, makeAbortError());
      };
      const opened = () => {
        this.events.emit("socket:open", { url: url.href, protocol: socket.protocol || "" });
        finish(resolve, socket);
      };
      const failed = event => {
        this.events.emit("socket:error", { url: url.href, event });
        finish(reject, new Error("WebSocket connection failed."));
      };
      socket.addEventListener("open", opened, { once: true });
      socket.addEventListener("error", failed, { once: true });
      socket.addEventListener("message", event => this.events.emit("socket:message", event));
      socket.addEventListener("close", event => this.events.emit("socket:close", event));
      signal?.addEventListener("abort", abort, { once: true });
      if (this.connectionTimeout > 0) timer = setTimeout(() => {
        try { socket.close(); } catch {}
        finish(reject, new DOMException("WebSocket connection timed out.", "TimeoutError"));
      }, this.connectionTimeout);
    });
  }

  send(data) {
    const socket = this.socket;
    if (!socket || socket.readyState !== this.WebSocketImpl.OPEN) throw new Error("WebSocket is not open.");
    if (socket.bufferedAmount > this.maxBufferedAmount) throw new DOMException("WebSocket send buffer limit exceeded.", "QuotaExceededError");
    socket.send(data);
    this.events.emit("socket:send", { bufferedAmount: socket.bufferedAmount });
    return socket.bufferedAmount;
  }

  close(code, reason) {
    if (!this.socket) return false;
    this.socket.close(code, reason);
    return true;
  }

  getState() {
    const socket = this.socket;
    return socket ? { readyState: socket.readyState, bufferedAmount: socket.bufferedAmount, url: socket.url } : null;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    try { this.socket?.close(1000, "Adapter disposed"); } catch {}
    this.socket = null;
    this.events.clear();
  }
}

export class EventSourceAdapter {
  constructor({ EventSourceImpl = globalThis.EventSource, connectionTimeout = 10000, allowedOrigins = null } = {}) {
    if (typeof EventSourceImpl !== "function") throw new Error("EventSource is not available in this environment.");
    this.EventSourceImpl = EventSourceImpl;
    this.connectionTimeout = Math.max(0, Number(connectionTimeout) || 0);
    this.allowedOrigins = allowedOrigins ? new Set(allowedOrigins) : null;
    this.source = null;
    this.events = new EventBus();
    this.disposed = false;
  }

  on(type, listener) { return this.events.on(type, listener); }

  async connect(value, { withCredentials = false, signal } = {}) {
    if (this.disposed) throw new Error("EventSourceAdapter has been disposed.");
    if (this.source) throw new Error("An EventSource connection is already active.");
    const url = validateUrl(value, new Set(["http:", "https:"]));
    if (this.allowedOrigins && !this.allowedOrigins.has(url.origin)) throw new DOMException("EventSource origin is not allowed.", "SecurityError");
    if (signal?.aborted) throw makeAbortError();
    const source = new this.EventSourceImpl(url.href, { withCredentials: Boolean(withCredentials) });
    this.source = source;
    this.events.emit("eventsource:connecting", { url: url.href });
    return new Promise((resolve, reject) => {
      let settled = false;
      let timer = null;
      const clean = () => {
        if (timer !== null) clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        source.removeEventListener?.("open", opened);
        source.removeEventListener?.("error", failed);
      };
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clean();
        fn(value);
      };
      const abort = () => {
        source.close();
        this.source = null;
        finish(reject, makeAbortError());
      };
      const opened = event => {
        this.events.emit("eventsource:open", event);
        finish(resolve, source);
      };
      const failed = event => {
        this.events.emit("eventsource:error", event);
        if (source.readyState === this.EventSourceImpl.CLOSED) finish(reject, new Error("EventSource connection closed before opening."));
      };
      source.addEventListener("open", opened, { once: true });
      source.addEventListener("error", failed);
      source.onmessage = event => this.events.emit("eventsource:message", event);
      signal?.addEventListener("abort", abort, { once: true });
      if (this.connectionTimeout > 0) timer = setTimeout(() => {
        source.close();
        this.source = null;
        finish(reject, new DOMException("EventSource connection timed out.", "TimeoutError"));
      }, this.connectionTimeout);
    });
  }

  addEventListener(type, listener, options) {
    if (!this.source) throw new Error("EventSource is not connected.");
    this.source.addEventListener(type, listener, options);
    return () => this.source?.removeEventListener(type, listener, options);
  }

  close() {
    if (!this.source) return false;
    this.source.close();
    this.source = null;
    this.events.emit("eventsource:close", {});
    return true;
  }

  getState() {
    return this.source ? { readyState: this.source.readyState, url: this.source.url, withCredentials: this.source.withCredentials } : null;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.close();
    this.events.clear();
  }
}

export class BroadcastChannelAdapter {
  constructor(name, { BroadcastChannelImpl = globalThis.BroadcastChannel } = {}) {
    if (typeof BroadcastChannelImpl !== "function") throw new Error("BroadcastChannel is not available in this environment.");
    if (typeof name !== "string" || !name.trim()) throw new TypeError("A channel name is required.");
    this.channel = new BroadcastChannelImpl(name);
    this.events = new EventBus();
    this.disposed = false;
    this.channel.addEventListener("message", event => this.events.emit("message", event));
    this.channel.addEventListener("messageerror", event => this.events.emit("messageerror", event));
  }

  on(type, listener) { return this.events.on(type, listener); }
  postMessage(value) {
    if (this.disposed) throw new Error("BroadcastChannelAdapter has been disposed.");
    this.channel.postMessage(value);
  }
  close() {
    if (this.disposed) return;
    this.disposed = true;
    this.channel.close();
    this.events.clear();
  }
  dispose() { this.close(); }
}
