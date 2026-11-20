export class WorkerManager {
  constructor({ maxWorkers = 8, WorkerClass = globalThis.Worker } = {}) {
    this.maxWorkers = maxWorkers;
    this.WorkerClass = WorkerClass;
    this.workers = new Map();
  }
  create(id, url, { onError, onMessageError, ...options } = {}) {
    if (!this.WorkerClass) throw new Error("Web Workers are not supported in this environment.");
    if (this.workers.has(id)) throw new Error("Worker id already exists: " + id);
    if (this.workers.size >= this.maxWorkers) throw new RangeError("Worker limit reached.");
    const worker = new this.WorkerClass(url, { type: "module", ...options });
    this.workers.set(id, worker);
    if (typeof onError === "function") worker.addEventListener?.("error", onError);
    if (typeof onMessageError === "function") worker.addEventListener?.("messageerror", onMessageError);
    return worker;
  }
  get(id) { return this.workers.get(id) || null; }
  post(id, message, transfer = []) {
    const worker = this.get(id);
    if (!worker) throw new Error("Worker not found: " + id);
    worker.postMessage(message, transfer);
  }
  terminate(id) {
    const worker = this.get(id);
    if (!worker) return false;
    worker.terminate();
    this.workers.delete(id);
    return true;
  }
  terminateAll() { for (const id of [...this.workers.keys()]) this.terminate(id); }
  get size() { return this.workers.size; }
}
