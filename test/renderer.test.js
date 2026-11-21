import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "../src/renderer/html-parser.js";
import { parseCSS, selectorSpecificity } from "../src/renderer/css-parser.js";
import { StyleEngine } from "../src/renderer/style-engine.js";
import { LayoutEngine } from "../src/renderer/layout-engine.js";
import { PaintEngine } from "../src/renderer/paint-engine.js";

test("HTML parser builds document, elements, attributes and decoded text", () => {
  const doc=parseHTML('<!doctype html><html><head><title>Test</title></head><body><main id="app"><p class="x">A &amp; B</p><img src="a.png"></main></body></html>');
  assert.equal(doc.title,"Test");
  assert.equal(doc.querySelector("#app").querySelector("p").textContent,"A & B");
  assert.equal(doc.querySelector("img").getAttribute("src"),"a.png");
});
test("HTML parser recovers missing document wrappers", () => {
  const doc=parseHTML("<h1>Hello</h1>");
  assert.ok(doc.documentElement);
  assert.ok(doc.body);
  assert.equal(doc.querySelector("h1").textContent,"Hello");
});
test("CSS parser extracts rules and important declarations", () => {
  const rules=parseCSS("p, .lead { color: red; margin: 2px !important; }");
  assert.equal(rules.length,2);
  assert.equal(rules[0].declarations[1].important,true);
  assert.equal(selectorSpecificity("#x.note"),110);
});
test("style engine applies selector and inline cascade", () => {
  const doc=parseHTML('<style>p { color: red } .note { font-size: 20px }</style><p class="note" style="color: blue">Hello</p>');
  const engine=new StyleEngine(); engine.addStylesheet(doc.querySelector("style").textContent); engine.compute(doc);
  const p=doc.querySelector("p");
  assert.deepEqual(engine.rules.map(rule => rule.selector), ["p", ".note"]);
  assert.equal(p.classList.contains("note"), true);
  assert.equal(p.computedStyle.color,"blue");
  assert.equal(p.computedStyle.fontSize,"20px");
});
test("layout engine creates measurable element boxes", () => {
  const doc=parseHTML("<main><h1>Title</h1><p>Paragraph text</p></main>");
  const styles=new StyleEngine(); styles.compute(doc);
  const layout=new LayoutEngine().layout(doc,{width:640,height:480});
  assert.ok(layout.boxes.length>=3);
  assert.ok(doc.querySelector("main").layout.width>0);
  assert.ok(layout.contentHeight>=480);
});

import { ResourceLoader, ResourceLoadError } from "../src/renderer/resource-loader.js";

test("resource loader resolves relative web URLs", () => {
  const loader=new ResourceLoader({fetch:async()=>new Response("ok")});
  assert.equal(loader.resolve("/asset.css","https://example.com/page"),"https://example.com/asset.css");
});
test("resource loader rejects unsupported URL schemes", () => {
  const loader=new ResourceLoader({fetch:async()=>new Response("ok")});
  assert.throws(()=>loader.resolve("javascript:alert(1)"),ResourceLoadError);
});
test("resource loader reads text while respecting response size limits", async () => {
  const loader=new ResourceLoader({fetch:async()=>new Response("hello"),maxBytes:16});
  const result=await loader.fetchText("https://example.com/page");
  assert.equal(result.text,"hello");
  const limited=new ResourceLoader({fetch:async()=>new Response("this is too long"),maxBytes:4});
  await assert.rejects(limited.fetchText("https://example.com/page"),/size limit/i);
});

test("CSS parser preserves media rules and evaluates them at compute time",()=>{
 const doc=parseHTML('<style>@media (max-width: 600px) { .panel { display: none; } } @media (min-width: 601px) { .panel { display: block; } }</style><div class="panel"></div>');
 const engine=new StyleEngine();engine.addStylesheet(doc.querySelector("style").textContent);
 engine.setViewport({width:500,height:700});engine.compute(doc);assert.equal(doc.querySelector(".panel").computedStyle.display,"none");
 engine.setViewport({width:900,height:700});engine.compute(doc);assert.equal(doc.querySelector(".panel").computedStyle.display,"block");
});

test("HTML fragment wrappers place content in the body and styles in the head",()=>{
 const doc=parseHTML('<style>p{color:red}</style><main><p>Hello</p></main>');
 assert.equal(doc.head.querySelector("style")!==null,true);
 assert.equal(doc.body.querySelector("main")!==null,true);
});
test("selector engine supports :not and general sibling combinators",()=>{
 const doc=parseHTML('<div><p class="skip">A</p><p>B</p><p class="active">C</p></div>');
 assert.equal(doc.querySelectorAll("p:not(.skip)").length,2);
 assert.equal(doc.querySelectorAll(".skip ~ .active").length,1);
});

test("CSS shorthand declarations affect computed box model and borders",()=>{
 const doc=parseHTML('<style>.card { margin: 4px 8px; padding: 3px; border: 2px solid red; }</style><div class="card"></div>');
 const engine=new StyleEngine();engine.addStylesheet(doc.querySelector("style").textContent);engine.compute(doc);
 const card=doc.querySelector(".card");
 assert.equal(card.computedStyle.marginTop,"4px");assert.equal(card.computedStyle.marginRight,"8px");
 assert.equal(card.computedStyle.paddingLeft,"3px");assert.equal(card.computedStyle.borderTopWidth,"2px");
 assert.equal(card.computedStyle.borderTopStyle,"solid");assert.equal(card.computedStyle.borderTopColor,"red");
});

test("layout engine supports flex rows and intrinsic image dimensions",()=>{
 const doc=parseHTML('<div class="row"><img src="planet.png"><span>Label</span></div><style>.row{display:flex;gap:8px}</style>');
 const image=doc.querySelector("img");image._intrinsicWidth=64;image._intrinsicHeight=48;
 const styles=new StyleEngine();styles.addStylesheet(doc.querySelector("style").textContent);styles.compute(doc);
 const layout=new LayoutEngine().layout(doc,{width:500,height:300});
 assert.equal(image.layout.width,64);assert.equal(image.layout.height,48);
 assert.ok(doc.querySelector(".row").layout.width>64);assert.ok(layout.boxes.length>=3);
});
test("paint engine paints a document into a canvas-like context",()=>{
 const calls=[];
 const context={canvas:{width:320,height:200},clearRect(){calls.push("clear");},fillRect(){calls.push("fill");},save(){},restore(){},beginPath(){},rect(){},clip(){},translate(){},fillText(text){calls.push(text);},measureText(text){return {width:String(text).length*8};}};
 const doc=parseHTML("<main><h1>Polaris</h1><p>Renderer test</p></main>");
 const styles=new StyleEngine();styles.compute(doc);
 const layout=new LayoutEngine().layout(doc,{width:320,height:200});
 const painter=new PaintEngine();painter.paint(doc,layout,context,{scrollY:10});
 assert.ok(calls.includes("Polaris"));assert.ok(calls.includes("Renderer test"));
});


test("renderer hides metadata and non-rendering head elements",()=>{
 const doc=parseHTML('<html><head><title>Hidden title</title><style>body{color:red}</style><script>not visible</script></head><body><p>Visible</p></body></html>');
 const styles=new StyleEngine();styles.compute(doc);
 for(const tag of ["head","title","style","script"])assert.equal(doc.querySelector(tag).computedStyle.display,"none");
 assert.equal(doc.body.querySelector("p").computedStyle.display,"block");
});

test("flex layout distributes flexible cards into columns",()=>{
 const doc=parseHTML('<main><div class="grid"><section class="card">One</section><section class="card">Two</section><section class="card">Three</section></div></main><style>.grid{display:flex;gap:12px}.card{flex:1;min-width:150px}</style>');
 const styles=new StyleEngine();styles.addStylesheet(doc.querySelector("style").textContent);styles.compute(doc);
 new LayoutEngine().layout(doc,{width:800,height:500});
 const cards=doc.querySelectorAll(".card");
 assert.equal(cards.length,3);
 assert.ok(cards[0].layout.width>=150);
 assert.ok(cards[1].layout.x>cards[0].layout.x);
 assert.ok(cards[2].layout.x>cards[1].layout.x);
});
test("resource loader reports a useful code when browser fetch is blocked",async()=>{
 const loader=new ResourceLoader({fetch:async()=>{throw new TypeError("Failed to fetch")}});
 await assert.rejects(loader.fetchText("https://example.com/"),error=>error.code==="CORS_OR_NETWORK_ERROR"&&/CORS/.test(error.message));
});