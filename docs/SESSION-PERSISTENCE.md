# Session persistence

`SessionPersistence` stores named snapshots of tab metadata using a `WebStorageAdapter` (or a compatible storage implementation). It does not export page contents, cookies, passwords, authentication tokens, or origin storage.

## Example

```js
import { SessionPersistence, TabManager, WebStorageAdapter } from "@polaris/engine";

const storage = new WebStorageAdapter({
  storage: window.localStorage,
  prefix: "my-browser:",
});
const tabs = new TabManager();
const sessions = new SessionPersistence({ storage });

tabs.create({ title: "Documentation", url: "https://example.com/docs" });
sessions.save("Research", tabs);

console.log(sessions.list());
sessions.restore("Research", tabs);
```

## API

- `save(name, tabManager)` saves a validated snapshot, replacing an existing snapshot with the same name.
- `load(name)` returns a structured clone of the snapshot, or `null`.
- `restore(name, tabManager)` restores a saved snapshot through the tab manager, or returns `null`.
- `list()` returns names, save timestamps and tab counts (not full snapshots).
- `remove(name)` removes one named session and returns whether it existed.
- `clear()` removes all named sessions and returns the number removed.

The default limit is 20 named sessions; the configurable limit is 1–100. Session names are limited to 80 characters and snapshots are capped at 100 tabs. Invalid stored records are ignored during listing and loading. Browser storage quota and privacy errors propagate from the storage adapter.

Snapshots contain only the tab fields exposed by `TabManager.serialise()`. They do not recreate a page's JavaScript state or guarantee that a saved URL remains available.
