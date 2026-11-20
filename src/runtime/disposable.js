export class DisposableStack {
  #items = [];
  #disposed = false;
  get disposed() { return this.#disposed; }
  use(value) {
    if (this.#disposed) throw new Error("This scope has already been disposed.");
    const dispose = typeof value === "function" ? value :
      value?.dispose?.bind(value) || value?.close?.bind(value) || value?.abort?.bind(value);
    if (typeof dispose !== "function") throw new TypeError("Resource must be a function or disposable object.");
    this.#items.push(dispose);
    return value;
  }
  defer(callback) { return this.use(callback); }
  move() {
    if (this.#disposed) throw new Error("This scope has already been disposed.");
    const next = new DisposableStack();
    next.#items = this.#items;
    this.#items = [];
    this.#disposed = true;
    return next;
  }
  async dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    const errors = [];
    for (const dispose of this.#items.reverse()) {
      try { await dispose(); } catch (error) { errors.push(error); }
    }
    this.#items = [];
    if (errors.length) throw new AggregateError(errors, "One or more resources failed to dispose.");
  }
}

export function createAbortScope(parentSignal) {
  const controller = new AbortController();
  if (parentSignal?.aborted) controller.abort(parentSignal.reason);
  else parentSignal?.addEventListener("abort", () => controller.abort(parentSignal.reason), { once: true });
  return controller;
}
