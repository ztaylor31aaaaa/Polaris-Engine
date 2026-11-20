# Transport provider configuration

Polaris Engine exposes `TransportProviderManager` so a host application can integrate a transport it operates and is authorised to use. No transport provider is bundled or selected automatically.

## Provider contract

A provider is a host-owned object:

```js
const provider = {
  id: "my-provider",
  name: "My approved transport",
  version: "1.0.0",
  capabilities: ["host-managed"],
  async initialize({ emit }) {
    emit("transport:provider-ready", { id: "my-provider" });
  },
  async connect({ signal } = {}) {
    // Establish the host application's permitted connection.
    // Respect AbortSignal and reject with a useful error on failure.
    return { connected: true };
  },
  async disconnect() {},
  async dispose() {}
};
```

Register and enable it explicitly:

```js
const transport = new TransportProviderManager();
transport.register(provider);
await transport.configure({
  enabled: true,
  selected: "my-provider",
  autoInitialise: true,
  connectTimeout: 15000
});
```

## Configuration

- `enabled`: off by default; must be explicitly enabled.
- `selected`: provider ID registered by the host.
- `autoInitialise`: initialise the selected provider during configuration.
- `connectTimeout`: 1,000–120,000 ms; timeout aborts the supplied signal.
- `status()`: current state, selected provider and timeout.
- `events`: provider registration, state, ready, connected and error events.

Provider implementations should honour cancellation, avoid storing credentials in settings, report typed errors, and clean up all resources in `disconnect`/ `dispose`.

The manager does not implement URL rewriting, proxy routing, concealment, or network-policy bypass. Integrators are responsible for their provider's authorisation, deployment, privacy, origin isolation and security review.
