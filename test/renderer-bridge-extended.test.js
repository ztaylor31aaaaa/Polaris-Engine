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

test("extended bridge supports attributes, classList, dataset and inline styles",async()=>{
 const doc=parseHTML('<main><p class="copy" data-user-name="Zac"></p></main>'),runtime=new PolarisDocumentRuntime({document:doc});runtime.decorateTree();
 const bridge=new PolarisDOMBridge({runtime}),p=doc.querySelector("p");
 const call=(id,method,args)=>bridge.handle({type:"call",id,method,args});
 await call(1,"classListAdd",{nodeId:p.nodeId,tokens:["active","selected"]});
 assert.equal((await call(2,"classListContains",{nodeId:p.nodeId,token:"active"})).result,true);
 await call(3,"setAttribute",{nodeId:p.nodeId,name:"aria-label",value:"sample"});
 assert.equal((await call(4,"getAttribute",{nodeId:p.nodeId,name:"aria-label"})).result,"sample");
 assert.equal((await call(5,"getDataset",{nodeId:p.nodeId})).result.userName,"Zac");
 await call(6,"setStyleProperty",{nodeId:p.nodeId,name:"color",value:"red"});
 assert.equal((await call(7,"getStyleProperty",{nodeId:p.nodeId,name:"color"})).result,"red");
 await call(8,"setStyleText",{nodeId:p.nodeId,value:"display: block; margin-top: 4px"});
 assert.match((await call(9,"getStyleText",{nodeId:p.nodeId})).result,/display:block|display: block/);
 bridge.close();
});