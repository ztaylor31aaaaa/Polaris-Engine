const WEB = new Set(["http:", "https:"]);
export function inspectUrl(input, base) {
  try {
    const url = base ? new URL(input, base) : new URL(input);
    return Object.freeze({
      valid: true, href: url.href, origin: url.origin, protocol: url.protocol,
      hostname: url.hostname, port: url.port, pathname: url.pathname,
      search: url.search, hash: url.hash, isWeb: WEB.has(url.protocol),
      isSecure: url.protocol === "https:", hasCredentials: Boolean(url.username || url.password)
    });
  } catch (error) {
    return Object.freeze({ valid: false, error: String(error.message || error) });
  }
}
export function normaliseWebUrl(input, base) {
  const url = new URL(input, base);
  if (!WEB.has(url.protocol)) throw new TypeError("Only HTTP and HTTPS URLs are supported.");
  if (url.username || url.password) throw new TypeError("URLs containing embedded credentials are not accepted.");
  url.hash = url.hash;
  return url.href;
}
export function sameOrigin(a, b) {
  try { return new URL(a).origin === new URL(b).origin; } catch { return false; }
}
export function resolveRelativeUrl(reference, base) {
  const result = new URL(reference, base);
  if (!WEB.has(result.protocol)) throw new TypeError("Only HTTP and HTTPS URLs are supported.");
  return result.href;
}
