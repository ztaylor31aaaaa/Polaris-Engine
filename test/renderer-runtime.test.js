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
 const child=await bridge.handle({type:"call",id:3,method:"createElement",args:{tagName:"p"}});
 const appended=await bridge.handle({type:"call",id:4,method:"appendChild",args:{parentId:id,childId:child.result}});
 assert.equal(appended.type,"result");assert.equal(doc.querySelector("main p")!==null,true);
 await bridge.handle({type:"call",id:5,method:"setStyle",args:{nodeId:child.result,property:"color",value:"red"}});
 assert.equal(doc.querySelector("p").style.color,"red");
 const denied=await bridge.handle({type:"call",id:2,method:"executeJavaScript",args:{source:"alert(1)"}});
 assert.equal(denied.type,"error");bridge.close();
});
test("accessibility tree exposes semantic roles and labels",()=>{
 const doc=parseHTML('<main><button aria-label="Save">x</button><img alt="Planet"></main>');
 const tree=buildAccessibilityTree(doc),main=tree[0];
 assert.equal(main.role,"main");assert.equal(main.children[0].role,"button");assert.equal(main.children[0].name,"Save");
 assert.equal(main.children[1].name,"Planet");
});
test("viewport emits resize and scroll updates",()=>{
 const viewport=new RendererViewport({width:400,height:300});const events=[];viewport.onChange(event=>events.push(event.type));
 viewport.resize(800,600,2);viewport.scrollTo(10,20);
 assert.deepEqual(events,["resize","scroll"]);assert.equal(viewport.snapshot().devicePixelRatio,2);
});

import { createStyleDeclaration } from "../src/renderer/style-declaration.js";
import { RendererNetworkPolicy } from "../src/renderer/network-policy.js";
import { getRendererCapabilities } from "../src/renderer/runtime-capabilities.js";
import { ElementNode } from "../src/renderer/document-model.js";

test("style declaration synchronises kebab and camel case properties",()=>{
 const el=new ElementNode("div"),style=createStyleDeclaration(el);
 style.backgroundColor="red";style.setProperty("margin-left","12px");
 assert.match(el.getAttribute("style"),/background-color:red/);
 assert.equal(style.getPropertyValue("margin-left"),"12px");
 style.removeProperty("margin-left");assert.equal(style.marginLeft,"");
});
test("selector engine handles structural, sibling and attribute selectors",()=>{
 const doc=parseHTML('<ul><li data-kind="a">A</li><li class="selected" data-kind="b">B</li><li>C</li></ul>');
 assert.equal(doc.querySelectorAll("li:nth-child(2)").length,1);
 assert.equal(doc.querySelectorAll('li[data-kind^="b"]').length,1);
 assert.equal(doc.querySelectorAll("li + li.selected").length,1);
 assert.equal(doc.querySelectorAll("li:first-child").length,1);
});
test("network policy restricts origins and unsafe methods",()=>{
 const policy=new RendererNetworkPolicy({allowedOrigins:["https://example.com"]});
 assert.equal(policy.check("https://example.com/a").method,"GET");
 assert.throws(()=>policy.check("https://other.example/"),/not permitted/i);
 assert.throws(()=>policy.check("https://example.com/",{method:"POST"}),/read-only/i);
});
test("renderer capability profile is explicit and honest",()=>{
 const caps=getRendererCapabilities();assert.equal(caps.htmlParsing,true);assert.equal(caps.javascriptExecution,false);assert.equal(caps.cssGrid,false);
});

import { ScriptRuntime } from "../src/renderer/script-runtime.js";

test("script runtime delegates execution to an explicit isolated engine adapter",async()=>{
 const doc=parseHTML('<script>globalThis.marker = 1</script><script type="application/json">{"x":1}</script>');
 const calls=[];
 const engine={async createContext(options){assert.ok(options.bridge);assert.deepEqual(options.permissions,["dom:read","dom:write","events"]);return {async evaluate(source,meta){calls.push({source,meta});return "ok";},async dispose(){calls.push({disposed:true});}};}};
 const runtime=new PolarisDocumentRuntime({document:doc});runtime.decorateTree();
 const scripts=new ScriptRuntime({engine,documentRuntime:runtime});
 const results=await scripts.start(doc);
 assert.equal(results.length,1);assert.equal(calls[0].source,"globalThis.marker = 1");
 await scripts.dispose();assert.equal(calls.at(-1).disposed,true);
});
test("script runtime refuses to execute without an isolated engine",async()=>{
 const doc=parseHTML("<script>1+1</script>"),runtime=new ScriptRuntime();
 await assert.rejects(runtime.start(doc),/isolated JavaScript engine/i);
});

test("script bridge forwards DOM events to the isolated runtime queue",async()=>{
 const doc=parseHTML("<main><button>Run</button></main>"),runtime=new PolarisDocumentRuntime({document:doc});runtime.decorateTree();
 const bridge=new PolarisScriptBridge({runtime}),button=doc.querySelector("button");
 const registered=await bridge.handle({type:"call",id:1,method:"addEventListener",args:{nodeId:button.nodeId,eventType:"click",listenerId:"listener-1"}});
 assert.equal(registered.type,"result");
 button.dispatchEvent(new PolarisEvent("click",{bubbles:true}));
 const events=bridge.drainEvents();assert.equal(events.length,1);assert.equal(events[0].listenerId,"listener-1");
 bridge.close();assert.equal(bridge.drainEvents().length,0);
});

test("DOM runtime parses innerHTML and insertAdjacentHTML mutations",()=>{
 const doc=parseHTML("<main><p>old</p></main>"),runtime=new PolarisDocumentRuntime({document:doc});runtime.decorateTree();
 const main=doc.querySelector("main");
 main.innerHTML='<section class="fresh"><b>new</b></section>';
 assert.equal(main.querySelector(".fresh b").textContent,"new");
 main.insertAdjacentHTML("beforeend","<p>second</p>");
 assert.equal(main.querySelectorAll("p").length,1);
 assert.equal(main.textContent,"newsecond");
});
test("DOM node clone and insertion helpers preserve tree ownership",()=>{
 const doc=parseHTML("<main><p>A</p></main>"),main=doc.querySelector("main"),p=main.querySelector("p");
 const clone=p.cloneNode(true);clone.textContent="B";p.after(clone);
 assert.equal(main.children.length,2);assert.equal(main.children[1].textContent,"B");
 assert.equal(clone.isConnected,true);clone.remove();assert.equal(clone.isConnected,false);
});

import { WorkerEngineAdapter } from "../src/renderer/worker-engine-adapter.js";

test("worker engine adapter routes create, evaluate and dispose RPC calls",async()=>{
 class FakeWorker{
  listeners=new Map();messages=[];terminated=false;
  addEventListener(type,callback){const list=this.listeners.get(type)??[];list.push(callback);this.listeners.set(type,list);}
  postMessage(message){this.messages.push(message);queueMicrotask(()=>{const result=message.type==="create-context"?{contextId:"ctx-1"}:message.type==="evaluate"?{value:message.source.length}:{disposed:true};for(const callback of this.listeners.get("message")??[])callback({data:{channel:"polaris-script",id:message.id,type:"result",result}});});}
  terminate(){this.terminated=true;}
 }
 const worker=new FakeWorker(),adapter=new WorkerEngineAdapter({workerFactory:()=>worker});
 const context=await adapter.createContext({permissions:["dom:read"],limits:{timeoutMs:2000}});
 const result=await context.evaluate("2 + 2",{filename:"test.js"});
 assert.equal(result.value,5);await context.dispose();await adapter.close();assert.equal(worker.terminated,true);
});

import { installPolarisScriptWorker } from "../src/renderer/script-worker-host.js";

test("worker-side host manages isolated contexts and evaluates through adapter",async()=>{
 class FakeScope{
  listeners=new Map();messages=[];
  addEventListener(type,fn){this.listeners.set(type,fn);}
  removeEventListener(type){this.listeners.delete(type);}
  postMessage(message){this.messages.push(message);}
  send(data){this.listeners.get("message")?.({data});}
 }
 const scope=new FakeScope(),host=installPolarisScriptWorker(scope,{async createContext(){return {async evaluate(source){return {length:source.length};},async dispose(){}};}});
 scope.send({channel:"polaris-script",type:"create-context",id:1,permissions:[],limits:{}});
 await new Promise(resolve=>setTimeout(resolve,0));
 const contextId=scope.messages[0].result.contextId;assert.equal(host.contextCount,1);
 scope.send({channel:"polaris-script",type:"evaluate",id:2,contextId,source:"abc"});
 await new Promise(resolve=>setTimeout(resolve,0));assert.equal(scope.messages[1].result.length,3);
 await host.dispose();assert.equal(host.contextCount,0);
});

test("worker script host supports asynchronous DOM bridge round trips",async()=>{
 class FakeScope{
  listeners=new Map();messages=[];
  addEventListener(type,fn){this.listeners.set(type,fn);}
  removeEventListener(type){this.listeners.delete(type);}
  postMessage(message){this.messages.push(message);}
  send(data){this.listeners.get("message")?.({data});}
 }
 let bridge;
 const scope=new FakeScope(),host=installPolarisScriptWorker(scope,{async createContext(options){bridge=options.bridge;return {async evaluate(){return await bridge.call({type:"call",id:7,method:"getAttribute",args:{nodeId:1,name:"id"}});}};}});
 scope.send({channel:"polaris-script",type:"create-context",id:1});
 await new Promise(resolve=>setTimeout(resolve,0));
 const contextId=scope.messages[0].result.contextId;
 scope.send({channel:"polaris-script",type:"evaluate",id:2,contextId,source:"read id"});
 await new Promise(resolve=>setTimeout(resolve,0));
 const bridgeCall=scope.messages.find(message=>message.type==="bridge-call");
 assert.ok(bridgeCall);scope.send({channel:"polaris-script",type:"bridge-result",id:bridgeCall.id,result:"app-root"});
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(scope.messages.at(-1).result,"app-root");await host.dispose();
});

import { PolarisDOMBridge } from "../src/renderer/script-bridge-extended.js";

test("expanded DOM bridge exposes allowlisted element construction and properties",async()=>{
 const doc=parseHTML("<main id='app'></main>"),runtime=new PolarisDocumentRuntime({document:doc});runtime.decorateTree();
 const bridge=new PolarisDOMBridge({runtime}),root=doc.querySelector("main").nodeId;
 const created=await bridge.handle({type:"call",id:1,method:"createElement",args:{tagName:"button"}});
 const button=created.result;
 await bridge.handle({type:"call",id:2,method:"setProperty",args:{nodeId:button,name:"textContent",value:"Launch"}});
 await bridge.handle({type:"call",id:3,method:"appendChild",args:{parentId:root,childId:button}});
 const text=await bridge.handle({type:"call",id:4,method:"getProperty",args:{nodeId:button,name:"textContent"}});
 assert.equal(text.result,"Launch");
 const matches=await bridge.handle({type:"call",id:5,method:"matches",args:{nodeId:button,selector:"button"}});
 assert.equal(matches.result,true);bridge.close();
});
