import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "../src/renderer/html-parser.js";
import { PolarisDocumentRuntime } from "../src/renderer/dom-runtime.js";
import { PolarisDOMBridge } from "../src/renderer/script-bridge-extended.js";

test("extended bridge exposes safe DOM traversal and properties",async()=>{
 const doc=parseHTML('<main><p class="copy">Hello</p></main>'),runtime=new PolarisDocumentRuntime({document:doc});runtime.decorateTree();
 const bridge=new PolarisDOMBridge({runtime}),main=doc.querySelector("main"),p=doc.querySelector("p");
 const call=(id,method,args)=>bridge.handle({type:"call",id,method,args});
 assert.equal((await call(1,"getProperty",{nodeId:p.nodeId,name:"textContent"})).result,"Hello");
 await call(2,"setProperty",{nodeId:p.nodeId,name:"textContent",value:"Updated"});
 assert.equal(p.textContent,"Updated");
 assert.equal((await call(3,"getParent",{nodeId:p.nodeId})).result,main.nodeId);
 assert.equal((await call(4,"matches",{nodeId:p.nodeId,selector:".copy"})).result,true);
 assert.equal((await call(5,"getChildren",{nodeId:main.nodeId})).result.length,1);
 assert.equal((await call(7,"querySelector",{nodeId:doc.nodeId,selector:".copy"})).result,p.nodeId);
 assert.equal((await call(8,"querySelectorAll",{nodeId:doc.nodeId,selector:"main p"})).result.length,1);
 assert.equal((await call(6,"getProperty",{nodeId:p.nodeId,name:"ownerDocument"})).type,"error");
 bridge.close();
});

test("extended bridge supports HTML insertion, text nodes and focus",async()=>{
 const doc=parseHTML("<main></main>"),runtime=new PolarisDocumentRuntime({document:doc});runtime.decorateTree();
 const bridge=new PolarisDOMBridge({runtime}),main=doc.querySelector("main");
 const call=(id,method,args)=>bridge.handle({type:"call",id,method,args});
 await call(1,"setInnerHTML",{nodeId:main.nodeId,value:"<section><b>new</b></section>"});
 await call(2,"insertAdjacentHTML",{nodeId:main.nodeId,position:"beforeend",html:"<p>next</p>"});
 assert.equal(main.children.length,2);
 const text=await call(3,"createTextNode",{text:"!"});
 await call(4,"appendChild",{parentId:main.nodeId,childId:text.result});
 assert.equal(main.textContent,"newnext!");
 const button=runtime.createElement("button");main.appendChild(button);
 await call(5,"focus",{nodeId:button.nodeId});assert.equal(runtime.activeElement,button);
 bridge.close();
});
