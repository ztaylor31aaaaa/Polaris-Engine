let nextNodeId = 1;

export class PolarisNode {
  constructor(type, name = "") {
    this.nodeId = nextNodeId++;
    this.nodeType = type;
    this.nodeName = name;
    this.parentNode = null;
    this.childNodes = [];
  }
  appendChild(node) {
    if (!(node instanceof PolarisNode)) throw new TypeError("Expected a PolarisNode");
    if (node === this || node.contains(this)) throw new Error("Cannot create a cyclic document tree");
    node.parentNode?.removeChild(node);
    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  }
  insertBefore(node, reference) {
    if (reference == null) return this.appendChild(node);
    const index = this.childNodes.indexOf(reference);
    if (index < 0) throw new Error("Reference node is not a child");
    node.parentNode?.removeChild(node);
    node.parentNode = this;
    this.childNodes.splice(index, 0, node);
    return node;
  }
  removeChild(node) {
    const index = this.childNodes.indexOf(node);
    if (index < 0) throw new Error("Node is not a child");
    this.childNodes.splice(index, 1);
    node.parentNode = null;
    return node;
  }
  replaceChildren(...nodes) {
    for (const child of this.childNodes) child.parentNode = null;
    this.childNodes = [];
    for (const node of nodes) this.appendChild(node);
  }
  contains(node) {
    for (let current = node; current; current = current.parentNode) if (current === this) return true;
    return false;
  }
  get firstChild() { return this.childNodes[0] ?? null; }
  get lastChild() { return this.childNodes.at(-1) ?? null; }
  get nextSibling() {
    if (!this.parentNode) return null;
    const list = this.parentNode.childNodes, i = list.indexOf(this);
    return list[i + 1] ?? null;
  }
  get previousSibling() {
    if (!this.parentNode) return null;
    const list = this.parentNode.childNodes, i = list.indexOf(this);
    return list[i - 1] ?? null;
  }
  get textContent() {
    if (this.nodeType === 3 || this.nodeType === 8) return this.data;
    return this.childNodes.map(node => node.textContent).join("");
  }
  set textContent(value) {
    this.replaceChildren();
    const text = String(value ?? "");
    if (text) this.appendChild(new TextNode(text));
  }
  *walk() {
    yield this;
    for (const child of this.childNodes) yield* child.walk();
  }
}

export class DocumentNode extends PolarisNode {
  constructor() {
    super(9, "#document");
    this.documentElement = null;
    this.head = null;
    this.body = null;
    this.stylesheets = [];
    this.title = "";
    this.url = "about:blank";
  }
  getElementById(id) { return this.querySelector("#" + escapeSelector(id)); }
  getElementsByTagName(tag) { return this.querySelectorAll(tag); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  querySelectorAll(selector) {
    const groups = String(selector).split(",").map(s => s.trim()).filter(Boolean);
    const result = [];
    for (const node of this.walk()) {
      if (node instanceof ElementNode && groups.some(group => matchesSelector(node, group))) result.push(node);
    }
    return result;
  }
}

export class ElementNode extends PolarisNode {
  constructor(tagName, attributes = {}) {
    const tag = String(tagName).toLowerCase();
    super(1, tag.toUpperCase());
    this.tagName = tag;
    this.attributes = new Map(Object.entries(attributes).map(([k,v]) => [k.toLowerCase(), String(v)]));
    this.style = Object.create(null);
    this.computedStyle = Object.create(null);
    this.layout = { x:0, y:0, width:0, height:0 };
    this.listeners = new Map();
  }
  getAttribute(name) { return this.attributes.has(String(name).toLowerCase()) ? this.attributes.get(String(name).toLowerCase()) : null; }
  hasAttribute(name) { return this.attributes.has(String(name).toLowerCase()); }
  setAttribute(name, value) { this.attributes.set(String(name).toLowerCase(), String(value)); }
  removeAttribute(name) { this.attributes.delete(String(name).toLowerCase()); }
  get id() { return this.getAttribute("id") ?? ""; }
  set id(value) { this.setAttribute("id", value); }
  get className() { return this.getAttribute("class") ?? ""; }
  set className(value) { this.setAttribute("class", value); }
  get classList() {
    const element = this;
    return {
      contains(name) { return element.className.split(/\s+/).includes(name); },
      add(...names) { element.className = [...new Set([...element.className.split(/\s+/).filter(Boolean), ...names])].join(" "); },
      remove(...names) { element.className = element.className.split(/\s+/).filter(n => n && !names.includes(n)).join(" "); },
      toggle(name, force) { const has = this.contains(name), add = force ?? !has; add ? this.add(name) : this.remove(name); return add; }
    };
  }
  addEventListener(type, callback) {
    if (typeof callback !== "function") return;
    const list = this.listeners.get(type) ?? new Set();
    list.add(callback); this.listeners.set(type, list);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  dispatchEvent(event) {
    if (!event || !event.type) throw new TypeError("Event requires a type");
    if (!event.target) event.target = this;
    for (const callback of this.listeners.get(event.type) ?? []) callback.call(this, event);
    return !event.defaultPrevented;
  }
  get children() { return this.childNodes.filter(n => n instanceof ElementNode); }
  get firstElementChild() { return this.children[0] ?? null; }
  get lastElementChild() { return this.children.at(-1) ?? null; }
  get childElementCount() { return this.children.length; }
  get nextElementSibling() { let n=this.nextSibling;while(n&&!(n instanceof ElementNode))n=n.nextSibling;return n; }
  get previousElementSibling() { let n=this.previousSibling;while(n&&!(n instanceof ElementNode))n=n.previousSibling;return n; }
  append(...nodes) { for(const node of nodes)this.appendChild(typeof node==="string"?new TextNode(node):node); }
  prepend(...nodes) { let ref=this.firstChild;for(const node of nodes)this.insertBefore(typeof node==="string"?new TextNode(node):node,ref); }
  getElementsByClassName(name) { const wanted=String(name).trim().split(/\\s+/).filter(Boolean);return [...this.walk()].filter(n=>n instanceof ElementNode&&wanted.every(c=>n.classList.contains(c))); }
  matches(selector) { return matchesSelector(this,selector); }
  closest(selector) { for(let node=this;node instanceof ElementNode;node=node.parentElement)if(node.matches(selector))return node;return null; }
  toggleAttribute(name,force) { const has=this.hasAttribute(name),next=force??!has;if(next)this.setAttribute(name,"");else this.removeAttribute(name);return next; }
  get innerText() { return this.textContent; }
  get innerHTML() { return this.childNodes.map(serializeNode).join(""); }
  querySelector(selector) { return queryWithin(this, selector, false)[0] ?? null; }
  querySelectorAll(selector) { return queryWithin(this, selector, false); }
}

export class TextNode extends PolarisNode {
  constructor(data) { super(3, "#text"); this.data = String(data); }
}
export class CommentNode extends PolarisNode {
  constructor(data) { super(8, "#comment"); this.data = String(data); }
}

function queryWithin(root, selector, includeRoot) {
  const groups = String(selector).split(",").map(s => s.trim()).filter(Boolean), out = [];
  for (const node of root.walk()) if ((includeRoot || node !== root) && node instanceof ElementNode && groups.some(g => matchesSelector(node,g))) out.push(node);
  return out;
}
function escapeSelector(value) { return String(value).replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^\x60{|}~])/g, "\\$1"); }
function matchesSimple(el, selector) {
  const attrs = [...selector.matchAll(/\[([\w-]+)(?:\s*=\s*["']?([^\]"']+)["']?)?\]/g)];
  selector = selector.replace(/\[[^\]]+\]/g, "");
  if (selector && selector !== "*") {
    const tag = selector.match(/^[a-zA-Z][\w-]*/)?.[0];
    if (tag && el.tagName !== tag.toLowerCase()) return false;
    for (const id of selector.matchAll(/#([\w-]+)/g)) if (el.id !== id[1]) return false;
    for (const cls of selector.matchAll(/\.([\w-]+)/g)) if (!el.classList.contains(cls[1])) return false;
  }
  for (const [,name,value] of attrs) {
    if (!el.hasAttribute(name)) return false;
    if (value !== undefined && el.getAttribute(name) !== value.trim()) return false;
  }
  return true;
}
export function matchesSelector(el, selector) {
  const parts = selector.trim().replace(/\s*>\s*/g, " > ").split(/\s+/);
  let current = el, i = parts.length - 1;
  if (!matchesSimple(current, parts[i])) return false;
  while (i > 0) {
    const combinator = parts[i - 1];
    if (combinator === ">") {
      current = current.parentNode;
      i -= 2;
      if (!(current instanceof ElementNode) || !matchesSimple(current, parts[i])) return false;
    } else {
      i--;
      let ancestor = current.parentNode;
      while (ancestor instanceof ElementNode && !matchesSimple(ancestor, parts[i])) ancestor = ancestor.parentNode;
      if (!(ancestor instanceof ElementNode)) return false;
      current = ancestor;
    }
  }
  return true;
}
function serializeNode(node) {
  if (node instanceof TextNode) return node.data.replace(/&/g,"&amp;").replace(/</g,"&lt;");
  if (node instanceof CommentNode) return "<!--" + node.data + "-->";
  if (!(node instanceof ElementNode)) return "";
  const attrs = [...node.attributes].map(([k,v]) => " " + k + '="' + v.replace(/&/g,"&amp;").replace(/"/g,"&quot;") + '"').join("");
  const voids = new Set(["area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"]);
  return "<" + node.tagName + attrs + ">" + (voids.has(node.tagName) ? "" : node.innerHTML + "</" + node.tagName + ">");
}
