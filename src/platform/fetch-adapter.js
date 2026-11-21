import { EventBus } from "../utils/events.js";

export class FetchTimeoutError extends Error {
  constructor(url, timeout) {
    super(`Request timed out after ${timeout}ms: ${url}`);
    this.name = "FetchTimeoutError";
    this.code = "POLARIS_FETCH_TIMEOUT";
    this.url = url;
    this.timeout = timeout;
  }
}

export class FetchAdapter {
  constructor({
    fetchImpl = globalThis.fetch,
    baseURL = globalThis.location?.href,
    timeout = 15000,
    headers,
    credentials,
  } = {}) {
    if (typeof fetchImpl !== "function") throw new TypeError("A Fetch-compatible function is required.");
    if (!Number.isFinite(timeout) || timeout < 0) throw new TypeError("timeout must be a non-negative number.");
    this.fetchImpl = fetchImpl;
    this.baseURL = baseURL;
    this.timeout = timeout;
    this.defaultHeaders = new Headers(headers || {});
    this.credentials = credentials;
    this.events = new EventBus();
  }

  on(type, listener) {
    return this.events.on(type, listener);
  }

  resolve(input) {
    const raw = input instanceof Request ? input.url : String(input);
    const url = this.baseURL ? new URL(raw, this.baseURL) : new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new TypeError("FetchAdapter only accepts HTTP and HTTPS URLs.");
    }
    return url.href;
  }

  async fetch(input, init = {}) {
    const url = this.resolve(input);
    const method = String(init.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    const controller = new AbortController();
    const callerSignal = init.signal || (input instanceof Request ? input.signal : undefined);
    const headers = new Headers(this.defaultHeaders);
    const requestHeaders = input instanceof Request ? input.headers : undefined;
    requestHeaders?.forEach((value, key) => headers.set(key, value));
    new Headers(init.headers || {}).forEach((value, key) => headers.set(key, value));
    const timeout = init.timeout ?? this.timeout;
    if (!Number.isFinite(timeout) || timeout < 0) throw new TypeError("timeout must be a non-negative number.");

    let timer = null;
    let timedOut = false;
    const abortFromCaller = () => controller.abort(callerSignal?.reason);
    if (callerSignal?.aborted) abortFromCaller();
    else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
    if (timeout > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort(new FetchTimeoutError(url, timeout));
      }, timeout);
    }

    const requestInit = { ...init, method, headers, signal: controller.signal };
    delete requestInit.timeout;
    if (this.credentials !== undefined && requestInit.credentials === undefined) {
      requestInit.credentials = this.credentials;
    }
    this.events.emit("fetch:start", { url, method, timeout });
    const startedAt = globalThis.performance?.now?.() ?? Date.now();

    try {
      const response = await this.fetchImpl(url, requestInit);
      const duration = (globalThis.performance?.now?.() ?? Date.now()) - startedAt;
      this.events.emit("fetch:response", { url, method, status: response.status, ok: response.ok, duration });
      return response;
    } catch (error) {
      if (timedOut) {
        const timeoutError = new FetchTimeoutError(url, timeout);
        this.events.emit("fetch:error", { url, method, error: timeoutError });
        throw timeoutError;
      }
      this.events.emit("fetch:error", { url, method, error });
      throw error;
    } finally {
      if (timer !== null) clearTimeout(timer);
      callerSignal?.removeEventListener("abort", abortFromCaller);
      this.events.emit("fetch:finish", { url, method });
    }
  }

  get(input, init = {}) { return this.fetch(input, { ...init, method: "GET" }); }
  post(input, body, init = {}) { return this.fetch(input, { ...init, method: "POST", body }); }
  put(input, body, init = {}) { return this.fetch(input, { ...init, method: "PUT", body }); }
  patch(input, body, init = {}) { return this.fetch(input, { ...init, method: "PATCH", body }); }
  delete(input, init = {}) { return this.fetch(input, { ...init, method: "DELETE" }); }
}
