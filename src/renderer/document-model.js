import { createStyleDeclaration } from "./style-declaration.js";
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
  get parentElement() { return this.parentNode instanceof ElementNode ? this.parentNode : null; }
  get isConnected() { for(let node=this;node;node=node.parentNode)if(node.nodeType===9)return true;return false; }
  remove() { this.parentNode?.removeChild(this); }
  before(...nodes) { if(!this.parentNode)return;for(const node of nodes)this.parentNode.insertBefore(typeof node==="string"?new TextNode(node):node,this); }
  after(...nodes) { if(!this.parentNode)return;let ref=this.nextSibling;for(const node of nodes)this.parentNode.insertBefore(typeof node==="string"?new TextNode(node):node,ref); }
  replaceWith(...nodes) { if(!this.parentNode)return;const parent=this.parentNode;for(const node of nodes)parent.insertBefore(typeof node==="string"?new TextNode(node):node,this);parent.removeChild(this); }
  cloneNode(deep=false) {
    let clone;
    if(this instanceof ElementNode)clone=new ElementNode(this.tagName,Object.fromEntries(this.attributes));
    else if(this instanceof TextNode)clone=new TextNode(this.data);
    else if(this instanceof CommentNode)clone=new CommentNode(this.data);
    else clone=new PolarisNode(this.nodeType,this.nodeName);
    if(deep)for(const child of this.childNodes)clone.appendChild(child.cloneNode(true));
    return clone;
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
    const groups = splitSelectorGroups(String(selector));
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
    this.style = createStyleDeclaration(this);
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
  get parentElement() { return this.parentNode instanceof ElementNode ? this.parentNode : null; }
  get nextElementSibling() { let n=this.nextSibling;while(n&&!(n instanceof ElementNode))n=n.nextSibling;return n; }
  get previousElementSibling() { let n=this.previousSibling;while(n&&!(n instanceof ElementNode))n=n.previousSibling;return n; }
  get lastElementChild() { return this.children.at(-1) ?? null; }
  get childElementCount() { return this.children.length; }
  get nextElementSibling() { let n=this.nextSibling;while(n&&!(n instanceof ElementNode))n=n.nextSibling;return n; }
  get previousElementSibling() { let n=this.previousSibling;while(n&&!(n instanceof ElementNode))n=n.previousSibling;return n; }
  append(...nodes) { for(const node of nodes)this.appendChild(typeof node==="string"?new TextNode(node):node); }
  prepend(...nodes) { let ref=this.firstChild;for(const node of nodes)this.insertBefore(typeof node==="string"?new TextNode(node):node,ref); }
  getElementsByClassName(name) { const wanted=String(name).trim().split(/\s+/).filter(Boolean);return [...this.walk()].filter(n=>n instanceof ElementNode&&wanted.every(c=>n.classList.contains(c))); }
  getElementsByTagName(tag) { const wanted=String(tag).toLowerCase();return [...this.walk()].filter(n=>n instanceof ElementNode&&(wanted==="*"||n.tagName===wanted)); }
  replaceChildren(...nodes) { super.replaceChildren(...nodes.map(node=>typeof node==="string"?new TextNode(node):node)); }
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

function splitSelectorGroups(selector){
  const groups=[];let start=0,depth=0,quote="";
  for(let i=0;i<selector.length;i++){const c=selector[i];if(quote){if(c===quote&&selector[i-1]!=="\\")quote="";continue;}if(c==="'"||c==='"'){quote=c;continue;}if(c==="["||c==="(")depth++;else if(c==="]"||c===")")depth--;else if(c===","&&depth===0){groups.push(selector.slice(start,i).trim());start=i+1;}}
  groups.push(selector.slice(start).trim());return groups.filter(Boolean);
}
function queryWithin(root, selector, includeRoot) {
  const groups = splitSelectorGroups(String(selector)), out = [];
  for (const node of root.walk()) if ((includeRoot || node !== root) && node instanceof ElementNode && groups.some(g => matchesSelector(node,g))) out.push(node);
  return out;
}
function escapeSelector(value) { return String(value).replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^\x60{|}~])/g, "\\$1"); }
function matchesCompound(el,selector){
  if(!(el instanceof ElementNode))return false;
  const attrMatches=[...selector.matchAll(/\[([\w-]+)\s*(?:(\^=|\$=|\*=|~=|\|=|=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+)))?\s*\]/g)];
  const withoutAttrs=selector.replace(/\[[^\]]+\]/g,"");
  const selectorBase=withoutAttrs.replace(/:not\([^)]*\)/g,"");
  const tag=selectorBase.match(/^[a-zA-Z][\w-]*/)?.[0];
  if(tag&&el.tagName!==tag.toLowerCase())return false;
  if(withoutAttrs.includes("*")&&!tag&&withoutAttrs[0]!=="*")return false;
  for(const [,id] of selectorBase.matchAll(/#([\w-]+)/g))if(el.id!==id)return false;
  for(const [,name] of selectorBase.matchAll(/\.([\w-]+)/g))if(!el.classList.contains(name))return false;
  for(const [,name,operator,double,single,bare] of attrMatches){
    if(!el.hasAttribute(name))return false;
    if(!operator)continue;
    const expected=double??single??bare??"",actual=el.getAttribute(name)??"";
    if(operator==="="&&actual!==expected)return false;
    if(operator==="^="&&!actual.startsWith(expected))return false;
    if(operator==="$="&&!actual.endsWith(expected))return false;
    if(operator==="*="&&!actual.includes(expected))return false;
    if(operator==="~="&&!actual.split(/\s+/).includes(expected))return false;
    if(operator==="|="&&actual!==expected&&!actual.startsWith(expected+"-"))return false;
  }
  const pseudos=[...withoutAttrs.matchAll(/:([\w-]+)(?:\(([^()]*)\))?/g)];
  for(const [,name,arg] of pseudos){
    const siblings=el.parentElement?.children??[],index=siblings.indexOf(el)+1;
    if(name==="root"&&el.parentElement)return false;
    if(name==="first-child"&&index!==1)return false;
    if(name==="last-child"&&index!==siblings.length)return false;
    if(name==="only-child"&&siblings.length!==1)return false;
    if(name==="nth-child"&&!matchesNth(index,arg??""))return false;
    if(name==="nth-of-type"&&!matchesNth(siblings.filter(n=>n.tagName===el.tagName).indexOf(el)+1,arg??""))return false;
    if(name==="empty"&&el.childNodes.some(n=>n.nodeType===1||(n.nodeType===3&&n.data.trim())))return false;
    if(name==="checked"&&!el.checked&&!el.hasAttribute("checked"))return false;
    if(name==="disabled"&&!el.hasAttribute("disabled"))return false;
    if(name==="enabled"&&el.hasAttribute("disabled"))return false;
    if(name==="not"&&matchesCompound(el,arg??""))return false;
    if(name==="hover"&&!el._hover)return false;
    if(name==="focus"&&!el._focus)return false;
    if(name==="link"&&!(el.tagName==="a"&&el.hasAttribute("href")))return false;
    if(!["root","first-child","last-child","only-child","nth-child","nth-of-type","empty","checked","disabled","enabled","not","hover","focus","link"].includes(name))return false;
  }
  return true;
}
function matchesNth(index,expression){
  const value=String(expression).replace(/\s+/g,"").toLowerCase();
  if(value==="odd")return index%2===1;if(value==="even")return index%2===0;
  if(/^\d+$/.test(value))return index===Number(value);
  const match=value.match(/^([+-]?\d*)n([+-]\d+)?$/);if(!match)return false;
  const a=match[1]===""||match[1]==="+"?1:match[1]==="-"?-1:Number(match[1]),b=Number(match[2]??0),n=(index-b)/a;
  return Number.isInteger(n)&&n>=0;
}
function tokenizeSelector(selector){
  const tokens=[];let buffer="",depth=0,quote="",pendingSpace=false;
  for(const char of selector.trim()){
    if(quote){buffer+=char;if(char===quote)quote="";continue;}
    if(char==="'"||char==='"'){quote=char;buffer+=char;continue;}
    if(char==="["||char==="(")depth++;
    if(char==="]"||char===")")depth--;
    if(depth===0&&(char===">"||char==="+"||char==="~")){
      if(buffer.trim())tokens.push(buffer.trim());tokens.push(char);buffer="";pendingSpace=false;continue;
    }
    if(depth===0&&/\s/.test(char)){if(buffer.trim()){tokens.push(buffer.trim());buffer="";pendingSpace=true;}continue;}
    if(pendingSpace){tokens.push(" ");pendingSpace=false;}
    buffer+=char;
  }
  if(buffer.trim())tokens.push(buffer.trim());
  return tokens;
}
export function matchesSelector(el,selector){
  const tokens=tokenizeSelector(String(selector));
  if(!tokens.length)return false;
  const compounds=[],combinators=[];
  for(const token of tokens){if([" ",">","+","~"].includes(token))combinators.push(token);else compounds.push(token);}
  if(!compounds.length||combinators.length!==compounds.length-1)return false;
  const matchAt=(node,index)=>{
    if(!(node instanceof ElementNode)||!matchesCompound(node,compounds[index]))return false;
    if(index===0)return true;
    const combinator=combinators[index-1];
    if(combinator===">")return matchAt(node.parentElement,index-1);
    if(combinator==="+")return matchAt(node.previousElementSibling,index-1);
    if(combinator==="~"){for(let sibling=node.previousElementSibling;sibling;sibling=sibling.previousElementSibling)if(matchAt(sibling,index-1))return true;return false;}
    for(let ancestor=node.parentElement;ancestor;ancestor=ancestor.parentElement)if(matchAt(ancestor,index-1))return true;
    return false;
  };
  return matchAt(el,compounds.length-1);
}
function serializeNode(node) {
  if (node instanceof TextNode) return node.data.replace(/&/g,"&amp;").replace(/</g,"&lt;");
  if (node instanceof CommentNode) return "<!--" + node.data + "-->";
  if (!(node instanceof ElementNode)) return "";
  const attrs = [...node.attributes].map(([k,v]) => " " + k + '="' + v.replace(/&/g,"&amp;").replace(/"/g,"&quot;") + '"').join("");
  const voids = new Set(["area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"]);
  return "<" + node.tagName + attrs + ">" + (voids.has(node.tagName) ? "" : node.innerHTML + "</" + node.tagName + ">");
}
