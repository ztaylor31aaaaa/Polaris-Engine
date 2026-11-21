/**
 * A feature-by-feature migration map for the Scramjet compatibility effort.
 * Status describes Polaris implementation, not claims of browser parity.
 * Proxy transport, request rewriting and filter/access-control evasion are
 * intentionally outside this compatibility layer.
 */
export const SCRAMJET_PORT_FEATURES = Object.freeze([
  {id:"dom-tree",group:"DOM",status:"partial",detail:"Polaris document model, selectors, attributes, classList, dataset and inline style operations."},
  {id:"dom-events",group:"DOM",status:"partial",detail:"Runtime-mediated event listeners and basic propagation; browser event fidelity remains incomplete."},
  {id:"window-document",group:"Window and document",status:"partial",detail:"Frame-shaped facade and isolated DOM bridge; not native Window or Document objects."},
  {id:"history-location",group:"Navigation",status:"partial",detail:"History state and URL facade; traversal and popstate semantics need further conformance work."},
  {id:"url-resolution",group:"Navigation",status:"partial",detail:"Relative URL resolution and HTTP(S) navigation in the renderer."},
  {id:"html-rewriter",group:"Rewriters",status:"not-implemented",detail:"No general-purpose HTML source rewriter."},
  {id:"css-rewriter",group:"Rewriters",status:"not-implemented",detail:"No general-purpose CSS URL or source rewriter."},
  {id:"javascript-rewriter",group:"Rewriters",status:"not-implemented",detail:"No Scramjet-compatible JavaScript transformer."},
  {id:"worker-rewriter",group:"Rewriters",status:"not-implemented",detail:"Worker source transformation is not implemented."},
  {id:"script-runtime",group:"JavaScript",status:"adapter-required",detail:"Worker RPC and allowlisted DOM bridge exist; a separately isolated interpreter must be supplied."},
  {id:"module-loader",group:"JavaScript",status:"not-implemented",detail:"ES modules, import maps and dynamic imports are not implemented in the renderer."},
  {id:"fetch-api",group:"Network APIs",status:"partial",detail:"Native Fetch adapter with browser-enforced CORS and host policy; no proxy rewriting."},
  {id:"xhr-api",group:"Network APIs",status:"not-implemented",detail:"XMLHttpRequest compatibility is not implemented in the renderer."},
  {id:"websocket-api",group:"Network APIs",status:"adapter-available",detail:"Separate host WebSocket adapter exists; page-realm integration is incomplete."},
  {id:"eventsource-api",group:"Network APIs",status:"adapter-available",detail:"Separate host EventSource adapter exists; page-realm integration is incomplete."},
  {id:"storage-apis",group:"Storage",status:"partial",detail:"Host storage modules exist; browser-compatible page-realm local/session storage and IndexedDB bindings remain incomplete."},
  {id:"cookie-api",group:"Storage",status:"not-implemented",detail:"No cross-origin cookie jar or document.cookie emulation."},
  {id:"message-apis",group:"Messaging",status:"partial",detail:"MessagePort RPC and BroadcastChannel adapters exist; browser structured-clone and origin semantics need work."},
  {id:"web-workers",group:"Workers",status:"partial",detail:"Worker lifecycle and isolated script worker protocol exist; native Worker semantics are incomplete."},
  {id:"service-workers",group:"Workers",status:"not-implemented",detail:"No page-controlled ServiceWorkerContainer or service-worker lifecycle emulation."},
  {id:"resource-loading",group:"Resources",status:"partial",detail:"Bounded HTTP(S) resource loading subject to normal browser security policies."},
  {id:"forms",group:"DOM",status:"partial",detail:"Basic form collection and URL-encoded GET/POST support."},
  {id:"error-diagnostics",group:"Diagnostics",status:"partial",detail:"Structured renderer and compatibility errors; full rewriter diagnostics are not implemented."}
]);
export function getScramjetPortReport(){
  const counts={implemented:0,partial:0,"adapter-available":0,"adapter-required":0,"not-implemented":0};
  for(const feature of SCRAMJET_PORT_FEATURES)counts[feature.status]=(counts[feature.status]??0)+1;
  return Object.freeze({
    name:"Polaris Scramjet compatibility port",
    complete:false,
    features:SCRAMJET_PORT_FEATURES,
    counts:Object.freeze(counts),
    nextAreas:Object.freeze(["HTML/CSS parsing and source transforms for migration-only use","isolated JavaScript engine integration","browser DOM and event conformance","storage and messaging bindings","worker lifecycle compatibility"])
  });
}
