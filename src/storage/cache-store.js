export class CacheStore {
  constructor({ cacheName = "polaris-engine-v1", cacheStorage = globalThis.caches } = {}) {
    this.cacheName = cacheName;
    this.cacheStorage = cacheStorage;
    this.cachePromise = null;
  }
  async #cache() {
    if (!this.cacheStorage?.open) throw new Error("Cache Storage API is unavailable.");
    return this.cachePromise ||= this.cacheStorage.open(this.cacheName);
  }
  async match(request, options) { return (await this.#cache()).match(request, options); }
  async put(request, response) {
    if (!(response instanceof Response)) throw new TypeError("A Response object is required.");
    if (!response.ok || response.status === 206) throw new TypeError("Only complete successful responses can be cached.");
    return (await this.#cache()).put(request, response.clone());
  }
  async delete(request, options) { return (await this.#cache()).delete(request, options); }
  async keys(request, options) { return (await this.#cache()).keys(request, options); }
  async clear() {
    if (!this.cacheStorage?.delete) throw new Error("Cache Storage API is unavailable.");
    this.cachePromise = null;
    return this.cacheStorage.delete(this.cacheName);
  }
}
