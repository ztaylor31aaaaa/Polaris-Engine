/**
 * A deliberately small adapter for applications being ported from a legacy
 * controller-based runtime. It offers familiar lifecycle verbs but does not
 * emulate proxying, URL rewriting or undocumented Scramjet/Ultraviolet internals.
 */
export function createLegacyMigrationFacade({ tabs, views, runtimes = null } = {}) {
  if (!tabs || typeof tabs.create !== "function" || typeof tabs.close !== "function") {
    throw new TypeError("A Polaris TabManager is required.");
  }
  if (!views || typeof views.mount !== "function" || typeof views.unmount !== "function") {
    throw new TypeError("A Polaris ViewAdapter is required.");
  }
  const managedTabs = new Set();
  let disposed = false;

  async function open(url, { tabId = null, title = "Page", pinned = false, group = "" } = {}) {
    if (disposed) throw new Error("Legacy migration facade has been disposed.");
    const target = new URL(url);
    if (!["http:", "https:"].includes(target.protocol)) throw new TypeError("Only HTTP(S) URLs can be opened.");
    const created = !tabId;
    const tab = created ? tabs.create({ title, url: target.href, pinned, group }) :
      (tabs.tabs || []).find(item => item.id === tabId);
    if (!tab) throw new Error("The requested Polaris tab does not exist.");
    managedTabs.add(tab.id);
    let runtimeStarted = false;
    try {
      if (runtimes?.start) {
        await runtimes.start(tab.id, { url: target.href, title });
        runtimeStarted = true;
      }
      const frame = await views.mount({ tabId: tab.id, url: target.href, title });
      tabs.update?.(tab.id, { url: target.href, title });
      return { tab, frame, url: target.href };
    } catch (error) {
      if (runtimeStarted) { try { await runtimes.stop(tab.id, "view-mount-failed"); } catch {} }
      if (created) tabs.close(tab.id);
      managedTabs.delete(tab.id);
      throw error;
    }
  }

  return Object.freeze({
    async init() {
      if (disposed) throw new Error("Legacy migration facade has been disposed.");
      return this;
    },
    open,
    async navigate(url, options = {}) {
      const tabId = options.tabId || tabs.activeId;
      return tabId && managedTabs.has(tabId) ? open(url, { ...options, tabId }) : open(url, options);
    },
    async close(tabId = tabs.activeId) {
      if (!managedTabs.has(tabId)) return false;
      let failure = null;
      try { await views.unmount({ tabId }); } catch (error) { failure = error; }
      try { if (runtimes?.stop) await runtimes.stop(tabId, "legacy-facade-close"); }
      catch (error) { failure ||= error; }
      tabs.close(tabId);
      managedTabs.delete(tabId);
      if (failure) throw failure;
      return true;
    },
    getFrame(tabId = tabs.activeId) { return views.getFrame?.(tabId) || null; },
    getStatus(tabId = tabs.activeId) { return views.getStatus?.(tabId) || null; },
    on(event, listener) {
      if (typeof views.on !== "function") throw new Error("The configured ViewAdapter does not expose events.");
      return views.on(event, listener);
    },
    async dispose() {
      if (disposed) return;
      const failures = [];
      for (const tabId of [...managedTabs]) {
        try { await this.close(tabId); } catch (error) { failures.push(error); }
      }
      disposed = true;
      if (failures.length) throw new AggregateError(failures, "One or more managed tabs failed to clean up.");
    },
    get disposed() { return disposed; },
    get managedTabIds() { return [...managedTabs]; }
  });
}
