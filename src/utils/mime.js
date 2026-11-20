const MIME_BY_EXTENSION = Object.freeze({
  html: "text/html", htm: "text/html", css: "text/css", js: "text/javascript", mjs: "text/javascript",
  json: "application/json", xml: "application/xml", svg: "image/svg+xml", png: "image/png",
  jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", avif: "image/avif",
  txt: "text/plain", md: "text/markdown", pdf: "application/pdf", wasm: "application/wasm",
  mp3: "audio/mpeg", mp4: "video/mp4", webm: "video/webm", woff: "font/woff", woff2: "font/woff2"
});
export function mimeFromExtension(input, fallback = "application/octet-stream") {
  const ext = String(input).split(/[?#]/)[0].split(".").pop().toLowerCase();
  return MIME_BY_EXTENSION[ext] || fallback;
}
export function extensionFromMime(mime) {
  const clean = String(mime).split(";")[0].trim().toLowerCase();
  return Object.keys(MIME_BY_EXTENSION).find(ext => MIME_BY_EXTENSION[ext] === clean) || null;
}
export function isTextMime(mime) {
  const value = String(mime).toLowerCase();
  return value.startsWith("text/") || /(?:json|xml|javascript|svg|wasm)/.test(value);
}
export function normaliseMime(mime, fallback = "application/octet-stream") {
  const value = String(mime || "").split(";")[0].trim().toLowerCase();
  return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(value) ? value : fallback;
}
