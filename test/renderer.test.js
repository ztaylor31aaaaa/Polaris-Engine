import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "../src/renderer/html-parser.js";
import { parseCSS, selectorSpecificity } from "../src/renderer/css-parser.js";
import { StyleEngine } from "../src/renderer/style-engine.js";
import { LayoutEngine } from "../src/renderer/layout-engine.js";

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
