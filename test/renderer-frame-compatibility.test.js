import test from "node:test";
import assert from "node:assert/strict";
import { PolarisFrameCompatibility } from "../src/renderer/frame-compatibility.js";

function canvas(){
 const context={canvas:null,save(){},restore(){},clearRect(){},fillRect(){},strokeRect(){},fillText(){},measureText(t){return {width:String(t).length*7}},beginPath(){},rect(){},clip(){},translate(){},drawImage(){},roundRect(){}};
 const canvas={width:640,height:480,getContext(){return context},addEventListener(){},removeEventListener(){},getBoundingClientRect(){return {left:0,top:0,width:640,height:480}}};context.canvas=canvas;return canvas;
}
test("frame compatibility facade exposes frame-shaped document and window APIs",()=>{
 const frame=new PolarisFrameCompatibility({canvas:canvas()});
 frame.setHTML("<html><head><title>Test</title></head><body><main id='app'>Hello</main></body></html>",{url:"https://example.test/"});
 assert.equal(frame.contentDocument.title,"Test");
 assert.equal(frame.contentWindow.document.getElementById("app").textContent,"Hello");
 assert.equal(frame.contentWindow.location.origin,"https://example.test");
 assert.equal(frame.contentWindow.innerWidth,640);
 assert.equal(frame.frame,frame.renderer.canvas);
 assert.equal(typeof frame.go,"function");
 frame.destroy();
});
test("frame facade navigates through Polaris history and rejects use after destroy",()=>{
 const frame=new PolarisFrameCompatibility({canvas:canvas()});
 frame.setHTML("<p>Start</p>",{url:"https://example.test/"});
 assert.equal(frame.contentWindow.location.href,"https://example.test/");
 frame.navigate("https://example.test/next");
 assert.equal(frame.contentWindow.location.pathname,"/next");
 frame.destroy();
 assert.throws(()=>frame.setHTML("<p>late</p>"),/destroyed/);
});

test("frame history pushState changes URL without reloading the document",()=>{
 const frame=new PolarisFrameCompatibility({canvas:canvas()});
 frame.setHTML("<main id=app>Keep this document</main>",{url:"https://example.test/start"});
 const original=frame.contentDocument.getElementById("app");
 frame.history.pushState({page:2},"","/next?x=1#part");
 assert.equal(frame.location.href,"https://example.test/next?x=1#part");
 assert.equal(frame.contentDocument.getElementById("app"),original);
 assert.deepEqual(frame.renderer.history.current.state,{page:2});
 frame.history.replaceState({page:3},"","/final");
 assert.equal(frame.location.pathname,"/final");
 assert.deepEqual(frame.renderer.history.current.state,{page:3});
 frame.destroy();
});