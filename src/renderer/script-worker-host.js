/**
 * Worker-side protocol host for a separately bundled JavaScript engine.
 * Supply an engineFactory backed by an isolated interpreter/WASM runtime.
 * This protocol host itself never evaluates page source in the host realm.
 */
export function installPolarisScriptWorker(scope, engineFactory, options = {}) {
  if (!scope?.addEventListener || !scope?.postMessage) throw new TypeError("A WorkerGlobalScope-like object is required");
  if (!engineFactory || typeof engineFactory.createContext !== "function") throw new TypeError("engineFactory.createContext is required");
  const contexts = new Map();
  const pendingBridge = new Map();
  const maxContexts = options.maxContexts ?? 4;
  const maxMessageBytes = options.maxMessageBytes ?? 2 * 1024 * 1024;
  let nextContext = 0;
  let nextBridge = 0;
  let closed = false;
  const send = message => scope.postMessage({ channel: "polaris-script", ...message });
  const handle = async message => {
    if (closed || !message || message.channel !== "polaris-script") return;
    if (JSON.stringify(message).length > maxMessageBytes) {
      send({ type: "error", id: message.id, error: "Worker message exceeds size limit" });
      return;
    }
    if (message.type === "bridge-result") {
      const pending = pendingBridge.get(message.id);
      if (!pending) return;
      pendingBridge.delete(message.id);
      if (message.error) pending.reject(new Error(message.error));
      else pending.resolve(message.result);
      return;
    }
    try {
      if (message.type === "create-context") {
        if (contexts.size >= maxContexts) throw new Error("Worker context limit reached");
        const bridge = {
          call(request) {
            const id = ++nextBridge;
            return new Promise((resolve, reject) => {
              pendingBridge.set(id, { resolve, reject });
              send({ type: "bridge-call", id, request });
            });
          }
        };
        const context = await engineFactory.createContext({
          bridge,
          permissions: message.permissions ?? [],
          limits: message.limits ?? {}
        });
        const contextId = "polaris-context-" + (++nextContext);
        contexts.set(contextId, context);
        send({ type: "result", id: message.id, result: { contextId } });
        return;
      }
      if (message.type === "evaluate") {
        const context = contexts.get(message.contextId);
        if (!context) throw new Error("Unknown script context");
        if (typeof context.evaluate !== "function") throw new Error("Engine context does not implement evaluate");
        const result = await context.evaluate(String(message.source ?? ""), {
          filename: message.filename,
          timeoutMs: message.timeoutMs
        });
        send({ type: "result", id: message.id, result });
        return;
      }
      if (message.type === "dispose-context") {
        const context = contexts.get(message.contextId);
        if (context) {
          contexts.delete(message.contextId);
          await context.dispose?.();
        }
        send({ type: "result", id: message.id, result: { disposed: true } });
        return;
      }
      throw new Error("Unsupported worker protocol message");
    } catch (error) {
      send({ type: "error", id: message.id, error: String(error?.message ?? error) });
    }
  };
  const listener = event => { void handle(event.data); };
  scope.addEventListener("message", listener);
  return {
    get contextCount() { return contexts.size; },
    async dispose() {
      if (closed) return;
      closed = true;
      scope.removeEventListener?.("message", listener);
      for (const context of contexts.values()) await context.dispose?.();
      contexts.clear();
      for (const pending of pendingBridge.values()) pending.reject(new Error("Script worker host disposed"));
      pendingBridge.clear();
    }
  };
}
