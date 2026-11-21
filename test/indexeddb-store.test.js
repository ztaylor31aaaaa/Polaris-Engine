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
