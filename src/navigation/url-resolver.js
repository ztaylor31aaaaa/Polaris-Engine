const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

export function resolveAddress(input, options = {}) {
  const value = String(input ?? "").trim();
  if (!value) throw new TypeError("Enter a website address or search term.");

  const searchUrl = options.searchUrl || "https://www.google.com/search?q=%s";
  const hasScheme = /^[a-z][a-z\\d+.-]*:/i.test(value);
  const hasWebScheme = /^https?:\\/\\//i.test(value);
  if (hasScheme && !hasWebScheme) throw new TypeError("Only HTTP and HTTPS addresses are supported.");

  const looksLikeHost = /^(localhost|\\[[0-9a-f:]+\\]|[^\\s/]+\\.[a-z]{2,})(:\\d+)?([/?#].*)?$/i.test(value);
  const candidate = hasWebScheme ? value : looksLikeHost ? "https://" + value : null;

  if (!candidate) {
    if (!searchUrl.includes("%s")) throw new TypeError("Search URL must contain %s.");
    return new URL(searchUrl.replace("%s", encodeURIComponent(value))).href;
  }

  const url = new URL(candidate);
  if (!HTTP_PROTOCOLS.has(url.protocol)) throw new TypeError("Only HTTP and HTTPS addresses are supported.");
  if (!url.hostname) throw new TypeError("The address does not contain a hostname.");
  return url.href;
}

export function isWebAddress(value) {
  try {
    const url = new URL(value);
    return HTTP_PROTOCOLS.has(url.protocol) && Boolean(url.hostname);
  } catch { return false; }
}
