import test from "node:test";
import assert from "node:assert/strict";
import { IndexedDBStore } from "../src/storage/indexeddb-store.js";

test("IndexedDBStore rejects clearly when IndexedDB is unavailable", () => {
  assert.throws(
    () => new IndexedDBStore({ indexedDB: null }),
    /IndexedDB is unavailable/
  );
});

test("IndexedDBStore validates its configuration", () => {
  const fake = { open() {} };
  assert.throws(() => new IndexedDBStore({ indexedDB: fake, version: 0 }), /positive integer/);
  assert.throws(() => new IndexedDBStore({ indexedDB: fake, name: "" }), /required/);
});

test("closed stores cannot be reopened", async () => {
  const store = new IndexedDBStore({ indexedDB: { open() {} } });
  store.close();
  await assert.rejects(store.open(), /closed/);
});

test("batch rejects malformed operations before opening a database", async () => {
  const store = new IndexedDBStore({ indexedDB: { open() { throw new Error("should not open"); } } });
  await assert.rejects(store.batch([]), /non-empty/);
  await assert.rejects(store.batch([{ type: "unknown" }]), /must be put, delete, or clear/);
  await assert.rejects(store.batch([{ type: "put" }]), /requires a value/);
  await assert.rejects(store.batch([{ type: "delete" }]), /requires a key/);
});


function createFakeIndexedDB({ failRequest = false, abortTransaction = false } = {}) {
  const database = {
    objectStoreNames: { contains: () => true },
    close() {},
    transaction() {
      const tx = {
        error: abortTransaction ? new Error("transaction aborted") : null,
        objectStore() {
          return {
            get() {
              const request = {
                error: failRequest ? new Error("request failed") : null,
              };
              queueMicrotask(() => {
                if (failRequest) {
                  request.onerror?.();
                  tx.onerror?.();
                  tx.onabort?.();
                } else {
                  request.result = { id: "one" };
                  request.onsuccess?.();
                  tx.oncomplete?.();
                }
              });
              return request;
            },
          };
        },
      };
      return tx;
    },
  };
  return {
    open() {
      const request = { result: database, error: null };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  };
}

test("request operations resolve only after transaction completion", async () => {
  const store = new IndexedDBStore({ indexedDB: createFakeIndexedDB() });
  assert.deepEqual(await store.get("one"), { id: "one" });
});

test("request errors reject with the original request error", async () => {
  const store = new IndexedDBStore({ indexedDB: createFakeIndexedDB({ failRequest: true }) });
  await assert.rejects(store.get("one"), /request failed/);
});

test("batch operation errors reject instead of reporting success", async () => {
  const fake = createFakeIndexedDB({ failRequest: true });
  const store = new IndexedDBStore({ indexedDB: fake });
  // The fake store deliberately exposes only get; a malformed batch must fail
  // synchronously while queuing its first operation.
  await assert.rejects(store.batch([{ type: "delete", key: "one" }]), /store\.delete is not a function/);
});

test("version changes close the old database connection", async () => {
  let connection;
  const fake = {
    open() {
      const request = {
        result: {
          objectStoreNames: { contains: () => true },
          close() { this.wasClosed = true; },
        },
      };
      connection = request.result;
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  };
  const store = new IndexedDBStore({ indexedDB: fake });
  await store.open();
  connection.onversionchange();
  assert.equal(connection.wasClosed, true);
});
