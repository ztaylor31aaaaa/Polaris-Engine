# Migrating an application from Scramjet or Ultraviolet

Polaris Engine now includes a **code migration toolkit**. It scans project source files, reports legacy runtime references, creates a migration checklist, and can apply explicit text replacements supplied by the developer.

It does not execute imported project code, guess at runtime semantics, or claim that every legacy API has a drop-in replacement. Scramjet and Ultraviolet have different versions, integrations and application-specific wrappers; a safe migration needs a source scan and an explicit API mapping.

## 1. Scan a project

Pass source text as a path-to-content object. Read files using your own build tooling; the Engine toolkit does not access the filesystem.

```js
import { analyzeLegacyProject, createMigrationPlan } from "@polaris/engine";

const files = {
  "src/main.js": sourceText,
  "public/index.html": htmlText,
  "public/sw.js": workerText
};

const analysis = analyzeLegacyProject(files);
console.table(analysis.findings);
const plan = createMigrationPlan(analysis);
console.log(plan.steps);
```

The analyser reports file paths, occurrence counts, line numbers, severity and suggested next steps. It also scans common Vue, Svelte and Astro component files. It recognises common Scramjet, Ultraviolet, BareMux and legacy worker references. Some broad browser API matches are review hints, not proof of a dependency.

## 2. Scan from the command line

After installing the package, run the scanner against an existing project:

```sh
npx polaris-migrate ./my-existing-app --out polaris-migration-plan.json
```

The command scans supported JavaScript, TypeScript, HTML and JSON files, skips common generated/dependency folders, and writes a JSON migration plan. It does not edit source files. Exit code `2` means legacy references were found; exit code `1` means the scan failed.

## 2. Apply controlled replacements

The converter only changes strings that the developer explicitly maps. It never rewrites arbitrary runtime calls based on an assumed API equivalence. Each replacement can be restricted to named files and guarded with expected or maximum occurrence counts. The report includes exact changed line numbers so you can inspect the patch before writing it.

```js
import { convertLegacyProject } from "@polaris/engine";

const result = convertLegacyProject(files, {
  replacements: [
    { from: '"@old/app/navigation"', to: '"@polaris/engine"' }
  ]
});

// Review result.changes and result.analysis before writing files.
```

Use the returned file map to create a patch or write to a separate migration branch. Do not overwrite the original project until the converted version has been reviewed and tested.

## 3. Replace runtime responsibilities

Typical mapping:

| Legacy responsibility | Polaris Engine area |
| --- | --- |
| Runtime startup / lifecycle | `RuntimeManager`, `TabRuntime` |
| URL and navigation handling | `NavigationController`, `UrlWatcher` |
| Tab lifecycle | `TabManager` |
| Embedded view lifecycle | `ViewAdapter`, `FrameController` |
| Browser storage | `JsonStore`, `BookmarkStore`, `HistoryStore`, `CacheStore` |
| Worker lifecycle / messaging | `WorkerManager`, `MessageRPC` |
| Feature checks | `createFeatureProfile`, `createBrowserSurface` |
| Extension lifecycle | `ExtensionRegistry`, `PluginManager` |
| Optional transport integration | `TransportProviderManager` |

Example starting point:

```js
import {
  RuntimeManager,
  TabManager,
  NavigationController,
  ViewAdapter,
  createFeatureProfile
} from "@polaris/engine";

const features = createFeatureProfile();
features.require(["URL", "MessageChannel"]);

const tabs = new TabManager();
const navigation = new NavigationController();
const views = new ViewAdapter({ container: document.querySelector("#views") });
const runtime = new RuntimeManager({ tabs, navigation, views });

await runtime.start();
```

Check the constructor and lifecycle contracts in the API documentation for the installed Engine version before using this example in production.

## 4. Reduce application changes with the migration facade

For applications that currently expect a controller with `init`, `open`, `navigate`, `close` and frame/status access, Polaris provides a small opt-in facade:

```js
import {
  TabManager,
  ViewAdapter,
  RuntimeManager,
  createLegacyMigrationFacade
} from "@polaris/engine";

const tabs = new TabManager();
const views = new ViewAdapter({ container: document.querySelector("#views") });
const runtimes = new RuntimeManager();

const legacyController = createLegacyMigrationFacade({ tabs, views, runtimes });
await legacyController.init();
await legacyController.open("https://example.com");
```

The facade manages tabs it creates, mounts normal HTTP(S) views, and cleans up their runtimes when closed. It is a lifecycle adapter only: it does not implement Scramjet/Ultraviolet URL rewriting, proxy networking or undocumented methods. Applications must still port those responsibilities explicitly.

## 5. Transport and service workers

Legacy BareMux, Epoxy, proxy-worker or runtime-specific transport references require a separate architecture decision. Use native browser networking where it meets the application's needs, or register a transport provider that is explicitly authorised for the environment. Polaris does not include traffic disguise, network-filter bypass or an automatic replacement proxy.

Review service workers separately. Do not copy a legacy proxy worker into the Polaris application and assume that it is a general-purpose worker.

## 6. Validate the port

At minimum, test:
- Startup, shutdown and error recovery.
- Navigation, URL parsing, redirects and browser history.
- Tab creation, restoration and disposal.
- Storage migration and quota failures.
- Worker creation, messaging timeouts and cancellation.
- Cross-origin frame sandboxing and messaging.
- Missing browser APIs and fallback behaviour.
- Any application-specific authentication, media and file workflows.

The migration toolkit is an analyser and controlled codemod foundation, not a universal one-click converter. Review every finding and run the target application's tests before deployment.
