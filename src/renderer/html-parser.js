import { DocumentNode, ElementNode, TextNode, CommentNode } from "./document-model.js";

const VOID = new Set(["area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"]);
const RAW = new Set(["script","style","textarea","title"]);
const ENTITIES = { amp:"&",lt:"<",gt:">",quot:'"',apos:"'",nbsp:" " };
function decodeEntities(text) {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);?/gi, (all, key) => {
    if (key[0] === "#") {
      const hex = key[1]?.toLowerCase() === "x", n = Number.parseInt(key.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "�";
    }
    return ENTITIES[key.toLowerCase()] ?? all;
  });
}
function parseAttributes(source) {
  const attrs = {};
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match;
  while ((match = re.exec(source))) attrs[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
  return attrs;
}

export class HTMLParser {
  parse(input, options = {}) {
    const html = String(input ?? ""), doc = new DocumentNode();
    doc.url = options.url ?? "about:blank";
    const stack = [doc];
    let i = 0, steps = 0;
    while (i < html.length && steps++ < (options.maxTokens ?? 250000)) {
      const parent = stack.at(-1);
      if (html.startsWith("<!--", i)) {
        const end = html.indexOf("-->", i + 4), stop = end < 0 ? html.length : end;
        parent.appendChild(new CommentNode(html.slice(i + 4, stop))); i = end < 0 ? html.length : end + 3; continue;
      }
      if (/^<!doctype\b/i.test(html.slice(i, i + 12))) {
        const end = html.indexOf(">", i); i = end < 0 ? html.length : end + 1; continue;
      }
      if (html[i] === "<" && html[i + 1] === "/") {
        const end = html.indexOf(">", i), tag = html.slice(i + 2, end < 0 ? html.length : end).trim().split(/\s/)[0].toLowerCase();
        for (let s = stack.length - 1; s > 0; s--) if (stack[s].tagName === tag) { stack.length = s; break; }
        i = end < 0 ? html.length : end + 1; continue;
      }
      if (html[i] === "<" && /[a-zA-Z]/.test(html[i + 1] ?? "")) {
        const end = findTagEnd(html, i + 1);
        if (end < 0) { parent.appendChild(new TextNode("<")); i++; continue; }
        const token = html.slice(i + 1, end), selfClosing = /\/\s*$/.test(token);
        const match = token.match(/^([\w:-]+)([\s\S]*)$/);
        if (!match) { parent.appendChild(new TextNode("<" + token + ">")); i = end + 1; continue; }
        const tag = match[1].toLowerCase(), element = new ElementNode(tag, parseAttributes(match[2].replace(/\/\s*$/, "")));
        parent.appendChild(element); i = end + 1;
        if (tag === "html") doc.documentElement = element;
        if (tag === "head") doc.head = element;
        if (tag === "body") doc.body = element;
        if (tag === "title") doc.title = "";
        if (!VOID.has(tag) && !selfClosing) {
          stack.push(element);
          if (RAW.has(tag)) {
            const close = new RegExp("</" + tag + "\\s*>", "ig"); close.lastIndex = i;
            const m = close.exec(html), stop = m ? m.index : html.length;
            const raw = html.slice(i, stop);
            if (raw) element.appendChild(new TextNode(tag === "textarea" || tag === "title" ? decodeEntities(raw) : raw));
            if (tag === "title") doc.title = raw;
            i = m ? close.lastIndex : html.length; stack.pop();
          }
        }
        continue;
      }
      const next = html.indexOf("<", i), stop = next < 0 ? html.length : next;
      const text = html.slice(i, stop);
      if (text) parent.appendChild(new TextNode(decodeEntities(text)));
      i = stop;
    }
    if (steps >= (options.maxTokens ?? 250000)) throw new Error("HTML token limit exceeded");
    if (!doc.documentElement) {
      const htmlElement = new ElementNode("html");
      const headElement = doc.head ?? new ElementNode("head");
      const bodyElement = doc.body ?? new ElementNode("body");
      const originalChildren = [...doc.childNodes];
      for (const child of originalChildren) {
        if (child === headElement || child === bodyElement) continue;
        const target = ["base","link","meta","title","style"].includes(child.tagName) ? headElement : bodyElement;
        target.appendChild(child);
      }
      htmlElement.appendChild(headElement);
      htmlElement.appendChild(bodyElement);
      doc.appendChild(htmlElement);
      doc.documentElement = htmlElement;
      doc.head = headElement;
      doc.body = bodyElement;
    } else {
      if (!doc.head) {
        const head = new ElementNode("head");
        doc.documentElement.insertBefore(head, doc.documentElement.firstChild);
        doc.head = head;
      }
      if (!doc.body) {
        const body = new ElementNode("body");
        doc.documentElement.appendChild(body);
        doc.body = body;
      }
    }
    return doc;
  }
}
function findTagEnd(html, start) {
  let quote = "";
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (quote) { if (c === quote) quote = ""; }
    else if (c === '"' || c === "'") quote = c;
    else if (c === ">") return i;
  }
  return -1;
}
export function parseHTML(html, options) { return new HTMLParser().parse(html, options); }
