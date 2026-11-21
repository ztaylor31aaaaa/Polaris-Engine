# Moving data to Polaris

Polaris Engine 0.5.0 includes a portable JSON migration format and a preview-first importer.

## What transfers

- Bookmarks and folder labels
- Browsing history entries
- Open-tab URLs, titles, pinned state and group labels
- A limited allowlist of non-sensitive display and browser preferences

The importer accepts Polaris portable JSON, Netscape bookmark HTML exports, Chrome-style bookmark JSON trees, and common JSON arrays named `bookmarks`, `favorites`, `history`, `visits`, `tabs`, `openTabs`, and Chrome-style bookmark JSON trees under `roots`.

## Scramjet and Ultraviolet

Scramjet and Ultraviolet are browser-runtime/proxy frameworks, not standardised browser-data containers. They do not define one universal export format for bookmarks, history, tabs or settings. A Polaris import cannot directly read another site's local storage or a different origin's browser database.

For an app built on either runtime:
1. Use that app's own export/backup feature if it provides one.
2. Export bookmarks from the host browser as JSON (or convert a Netscape bookmarks HTML export to JSON).
3. If the app has a session export, include its tab list as a `tabs` array.
4. Open Polaris Engine → Import, select the JSON or HTML file (maximum 10 MB), inspect the detected format and counts, then choose merge or replace for the categories present in the file.

Example portable file:

```json
{
  "app": "Example browser",
  "bookmarks": [{ "title": "Example", "url": "https://example.com/" }],
  "history": [{ "title": "Example", "url": "https://example.com/", "visitedAt": "2026-01-01T10:00:00.000Z" }],
  "tabs": [{ "title": "Example", "url": "https://example.com/", "pinned": false }]
}
```

## Deliberately excluded

Cookies, passwords, authentication tokens, site local storage, IndexedDB contents and other origin-bound session data are not imported. Those items can contain active credentials and are not safely portable between different browser origins or deployments.

## Export

Use `exportPortableData({ bookmarks, history, tabs, settings })` to create the portable JSON schema. Use `exportBookmarksHtml(bookmarks)` to create a Netscape bookmark HTML file that common desktop browsers can import directly. Polaris offers both JSON and HTML export actions in its Engine panel. The exporter filters settings through a non-sensitive preference allowlist. Do not add credentials or site data to this format.

## API

- `inspectMigration(input)` validates and previews an import.
- `applyMigration(preview, { bookmarks, history, tabs, settings, mode: "merge" })` produces merged data without writing to storage.
- `exportPortableData(data)` produces a safe portable JSON object.

The caller controls persistence and should show a preview before applying the result.
