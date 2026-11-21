# Web Storage adapter

`WebStorageAdapter` wraps native `localStorage` or `sessionStorage` with JSON values, key namespacing and change events.

## Example

```js
import { WebStorageAdapter } from "@polaris/engine";

const settings = new WebStorageAdapter({
  storage: window.localStorage,
  prefix: "my-app:",
});

settings.set("preferences", { theme: "dark" });
const preferences = settings.get("preferences", { theme: "system" });

settings.on("storage:change", event => {
  console.log(event.key, event.oldValue, event.newValue, event.external);
});

// Removes only keys beginning with "my-app:".
settings.clear();
settings.dispose();
```

## API

- `get(key, fallback = null)` reads and parses JSON.
- `set(key, value)` serialises JSON and returns the value.
- `remove(key)` removes one namespaced key.
- `keys()` returns keys inside the configured namespace.
- `clear()` removes only namespaced keys and returns the number removed.
- `on("storage:change", listener)` subscribes to local and cross-document changes.
- `on("storage:clear", listener)` subscribes to a namespace clear.
- `dispose()` removes the native storage event listener and disables the adapter.

The adapter never clears unrelated application keys and does not patch browser globals. The browser's native storage rules still apply: `localStorage` is shared by same-origin documents, while `sessionStorage` is scoped to a top-level browsing context. Storage access can fail due to browser policy, privacy settings or quota limits; those errors are allowed to propagate.
