import test from "node:test";
import assert from "node:assert/strict";
import { PolarisFrameCompatibility } from "../src/renderer/frame-compatibility.js";

function canvas(){
 const context={save(){},restore(){},clearRect(){},fillRect(){},strokeRect(){},fillText(){},measureText(t){return {width:String(t).length*7}},beginPath(){},rect(){},clip(){},drawImage(){}};
 return {width:640,height:480,getContext(){return context},addEventListener(){},removeEventListener(){},getBoundingClientRect(){return {left:0,top:0,width:640,height:480}}};
}
test("frame compatibility facade exposes frame-shaped document and window APIs",()=>{
 const frame=new PolarisFrameCompatibility({canvas:canvas()});
 frame.setHTML("<html><head><title>Test</title></head><body><main id='app'>Hello</main></body></html>",{url:"https://example.test/"});
 assert.equal(frame.contentDocument.title,"Test");
 assert.equal(frame.contentWindow.document.getElementById("app").textContent,"Hello");
 assert.equal(frame.contentWindow.location.origin,"https://example.test");
 assert.equal(frame.contentWindow.innerWidth,640);
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
