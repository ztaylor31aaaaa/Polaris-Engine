/**
 * Promise-based IndexedDB adapter.
 *
 * Uses the browser's native IndexedDB implementation. No globals are patched.
 */
export class IndexedDBStore {
  constructor({
    name = "polaris-engine",
    storeName = "records",
    version = 1,
    keyPath = "id",
    indexedDB = globalThis.indexedDB
  } = {}) {
    if (!indexedDB?.open) throw new Error("IndexedDB is unavailable in this environment.");
    if (!name || !storeName) throw new TypeError("Database name and object store name are required.");
    if (!Number.isInteger(version) || version < 1) throw new TypeError("Database version must be a positive integer.");
    this.name = name;
    this.storeName = storeName;
    this.version = version;
    this.keyPath = keyPath;
    this.indexedDB = indexedDB;
    this.database = null;
    this.opening = null;
    this.closed = false;
  }

  open() {
    if (this.closed) return Promise.reject(new Error("IndexedDBStore is closed."));
    if (this.database) return Promise.resolve(this.database);
    if (this.opening) return this.opening;

    this.opening = new Promise((resolve, reject) => {
      let request;
      try {
        request = this.indexedDB.open(this.name, this.version);
      } catch (error) {
        reject(error);
        return;
      }

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, this.keyPath ? { keyPath: this.keyPath } : undefined);
        }
      };
      request.onblocked = () => {
        // Keep the request pending: another tab may still release its connection.
      };
      request.onerror = () => reject(request.error || new Error("Unable to open IndexedDB."));
      request.onsuccess = () => {
        const db = request.result;
        if (this.closed) {
          db.close();
          reject(new Error("IndexedDBStore was closed while opening."));
          return;
        }
        db.onversionchange = () => {
          db.close();
          if (this.database === db) this.database = null;
        };
        this.database = db;
        resolve(db);
      };
    }).finally(() => {
      this.opening = null;
    });

    return this.opening;
  }

  async #request(mode, operation) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      let transaction;
      let settled = false;
      const succeed = value => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const fail = error => {
        if (settled) return;
        settled = true;
        reject(error || new Error("IndexedDB operation failed."));
      };

      try {
        transaction = db.transaction(this.storeName, mode);
        const request = operation(transaction.objectStore(this.storeName));
        let result;
        request.onsuccess = () => { result = request.result; };
        request.onerror = () => {
          fail(request.error || new Error("IndexedDB request failed."));
        };
        transaction.oncomplete = () => succeed(result);
        transaction.onerror = () => {
          fail(transaction.error || new Error("IndexedDB transaction failed."));
        };
        transaction.onabort = () => {
          fail(transaction.error || new Error("IndexedDB transaction aborted."));
        };
      } catch (error) {
        fail(error);
        try { transaction?.abort(); } catch {}
      }
    });
  }

  get(key) {
    return this.#request("readonly", store => store.get(key));
  }

  getAll(query) {
    return this.#request("readonly", store => query === undefined ? store.getAll() : store.getAll(query));
  }

  count(query) {
    return this.#request("readonly", store => query === undefined ? store.count() : store.count(query));
  }

  put(value, key) {
    return this.#request("readwrite", store => {
      if (this.keyPath || key === undefined) return store.put(value);
      return store.put(value, key);
    });
  }

  delete(key) {
    return this.#request("readwrite", store => store.delete(key));
  }

  clear() {
    return this.#request("readwrite", store => store.clear());
  }

  async batch(operations) {
    if (!Array.isArray(operations) || operations.length === 0) {
      throw new TypeError("batch() requires a non-empty operations array.");
    }
    for (const operation of operations) {
      if (!operation || !["put", "delete", "clear"].includes(operation.type)) {
        throw new TypeError("Batch operations must be put, delete, or clear operations.");
      }
      if (operation.type === "put" && !("value" in operation)) {
        throw new TypeError("A put operation requires a value.");
      }
      if (operation.type === "delete" && !("key" in operation)) {
        throw new TypeError("A delete operation requires a key.");
      }
    }

    const db = await this.open();
    return new Promise((resolve, reject) => {
      let transaction;
      let settled = false;
      const succeed = value => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const fail = error => {
        if (settled) return;
        settled = true;
        reject(error || new Error("IndexedDB batch failed."));
      };

      try {
        transaction = db.transaction(this.storeName, "readwrite");
        const store = transaction.objectStore(this.storeName);
        for (const operation of operations) {
          let request;
          if (operation.type === "clear") request = store.clear();
          if (operation.type === "delete") request = store.delete(operation.key);
          if (operation.type === "put") {
            request = this.keyPath || operation.key === undefined
              ? store.put(operation.value)
              : store.put(operation.value, operation.key);
          }
          if (request) request.onerror = () => {
            fail(request.error || new Error("IndexedDB batch request failed."));
          };
        }
        transaction.oncomplete = () => succeed(true);
        transaction.onerror = () => {
          fail(transaction.error || new Error("IndexedDB batch failed."));
        };
        transaction.onabort = () => {
          fail(transaction.error || new Error("IndexedDB batch was aborted."));
        };
      } catch (error) {
        fail(error);
        try { transaction?.abort(); } catch {}
      }
    });
  }

  close() {
    this.closed = true;
    this.database?.close();
    this.database = null;
  }
}
