const DEFAULT_PROTOCOLS = new Set(["http:", "https:"]);
export class OriginPolicy {
  constructor({ protocols = [...DEFAULT_PROTOCOLS], allowLocalhost = true, blockedHosts = [] } = {}) {
    this.protocols = new Set(protocols);
    this.allowLocalhost = allowLocalhost;
    this.blockedHosts = new Set(blockedHosts.map(host => String(host).toLowerCase()));
  }
  inspect(input) {
    let url;
    try { url = new URL(input); } catch { return { allowed: false, reason: "invalid-url" }; }
    if (!this.protocols.has(url.protocol)) return { allowed: false, reason: "protocol-not-allowed", protocol: url.protocol };
    const host = url.hostname.toLowerCase();
    if (this.blockedHosts.has(host)) return { allowed: false, reason: "host-blocked", host };
    if (!this.allowLocalhost && (host === "localhost" || host === "127.0.0.1" || host === "::1")) return { allowed: false, reason: "local-address-disabled" };
    if (url.username || url.password) return { allowed: false, reason: "embedded-credentials" };
    return { allowed: true, origin: url.origin, protocol: url.protocol, host };
  }
  assert(input) {
    const result = this.inspect(input);
    if (!result.allowed) throw new TypeError("Navigation blocked by origin policy: " + result.reason);
    return new URL(input);
  }
}
