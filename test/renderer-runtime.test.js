import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "../src/renderer/html-parser.js";
import { PolarisDocumentRuntime, PolarisMutationObserver } from "../src/renderer/dom-runtime.js";
import { PolarisEvent } from "../src/renderer/dom-events.js";
import { PolarisHistory } from "../src/renderer/history-runtime.js";
import { encodeFormData } from "../src/renderer/forms.js";
import { PolarisScriptBridge } from "../src/renderer/script-bridge.js";
import { buildAccessibilityTree } from "../src/renderer/accessibility.js";
import { RendererViewport } from "../src/renderer/viewport.js";

test("DOM runtime supports element creation, dataset, values and selectors",()=>{
 const doc=parseHTML('<main><input id="q" data-user-name="zac" value="hello"><button class="action">Go</button></main>');
 const runtime=new PolarisDocumentRuntime({document:doc});runtime.decorateTree();
 const input=doc.querySelector("#q");
 assert.equal(input.dataset.userName,"zac");assert.equal(input.value,"hello");
 input.value="updated";assert.equal(input.value,"updated");
 const created=doc.createElement("span");created.classList.add("new");created.textContent="added";doc.querySelector("main").appendChild(created);
 assert.equal(doc.querySelector(".new").textContent,"added");
 assert.equal(created.closest("main"),doc.querySelector("main"));
});
test("DOM events bubble, support cancellation and once listeners",()=>{
 const doc=parseHTML("<main><button>Go</button></main>"),runtime=new PolarisDocumentRuntime({document:doc});runtime.decorateTree();
 const main=doc.querySelector("main"),button=doc.querySelector("button"),calls=[];
 main.addEventListener("click",()=>calls.push("parent"));
 button.addEventListener("click",event=>{calls.push("button");event.preventDefault();},{once:true});
 const first=button.dispatchEvent(new PolarisEvent("click",{bubbles:true,cancelable:true}));
 const second=button.dispatchEvent(new PolarisEvent("click",{bubbles:true,cancelable:true}));
 assert.equal(first,false);assert.equal(second,true);assert.deepEqual(calls,["button","parent","parent"]);
});
test("mutation observer filters records and disconnects",async()=>{
 const doc=parseHTML("<main></main>"),runtime=new PolarisDocumentRuntime({document:doc});runtime.decorateTree();
 const target=doc.querySelector("main");let received=[];
 const observer=new PolarisMutationObserver(records=>received.push(...records));
 observer.observe(runtime,target,{childList:true,subtree:true});
 runtime.append(target,doc.createElement("p"));
 await new Promise(resolve=>queueMicrotask(resolve));
 assert.equal(received.length,1);assert.equal(received[0].addedNodes[0].tagName,"p");
 observer.disconnect();
});
test("history supports push, replace, back and restore",()=>{
 const history=new PolarisHistory();history._navigate("https://example.com/a",null,false);
 history.pushState({page:2},"","/b");assert.equal(history.current.url,"https://example.com/b");
 history.back();assert.equal(history.current.url,"https://example.com/a");
 const snapshot=history.snapshot(),copy=new PolarisHistory();copy.restore(snapshot);assert.equal(copy.current.url,"https://example.com/a");
});
test("form encoder includes named enabled controls",()=>{
 const doc=parseHTML('<form action="/search"><input name="q" value="polaris"><input name="ignored" disabled value="x"><input type="checkbox" name="flag" checked value="yes"></form>');
 const runtime=new PolarisDocumentRuntime({document:doc});runtime.decorateTree();
 const result=encodeFormData(doc.querySelector("form"));
 assert.match(result.url,/q=polaris/);assert.match(result.url,/flag=yes/);assert.doesNotMatch(result.url,/ignored/);
});
test("script bridge only accepts its explicit DOM operation allowlist",async()=>{
 const doc=parseHTML("<main id='root'></main>"),runtime=new PolarisDocumentRuntime({document:doc});runtime.decorateTree();
 const bridge=new PolarisScriptBridge({runtime}),id=doc.querySelector("main").nodeId;
 const result=await bridge.handle({type:"call",id:1,method:"setAttribute",args:{nodeId:id,name:"data-ready",value:"yes"}});
 assert.equal(result.type,"result");assert.equal(doc.querySelector("main").getAttribute("data-ready"),"yes");
 const denied=await bridge.handle({type:"call",id:2,method:"executeJavaScript",args:{source:"alert(1)"}});
 assert.equal(denied.type,"error");bridge.close();
});
test("accessibility tree exposes semantic roles and labels",()=>{
 const doc=parseHTML('<main><button aria-label="Save">x</button><img alt="Planet"></main>');
 const tree=buildAccessibilityTree(doc),main=tree[0].children[0];
 assert.equal(main.role,"main");assert.equal(main.children[0].role,"button");assert.equal(main.children[0].name,"Save");
 assert.equal(main.children[1].name,"Planet");
});
test("viewport emits resize and scroll updates",()=>{
 const viewport=new RendererViewport({width:400,height:300});const events=[];viewport.onChange(event=>events.push(event.type));
 viewport.resize(800,600,2);viewport.scrollTo(10,20);
 assert.deepEqual(events,["resize","scroll"]);assert.equal(viewport.snapshot().devicePixelRatio,2);
});
