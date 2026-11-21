import test from "node:test";
import assert from "node:assert/strict";
import { ResourceLoader, ResourceLoadError } from "../src/renderer/resource-loader.js";

test("resource loader reports browser-hidden CORS/network cause without guessing",async()=>{
 const loader=new ResourceLoader({fetch:async()=>{throw new TypeError("Failed to fetch");}});
 await assert.rejects(loader.fetchText("https://example.test/"),error=>{
  assert.ok(error instanceof ResourceLoadError);
  assert.equal(error.code,"CORS_OR_NETWORK_ERROR");
  assert.equal(error.causeName,"TypeError");
  assert.match(error.message,/does not expose/i);
  return true;
 });
});

test("resource loader distinguishes HTTP failures",async()=>{
 const loader=new ResourceLoader({fetch:async url=>new Response("missing",{status:404})});
 await assert.rejects(loader.fetchText("https://example.test/missing"),error=>error.code==="HTTP_ERROR");
});

test("resource loader reports redirect destination",async()=>{
 const loader=new ResourceLoader({fetch:async url=>new Response("<main>ok</main>",{status:200,headers:{"content-type":"text/html"}})});
 const result=await loader.fetchText("https://example.test/start");
 assert.equal(result.requestedURL,"https://example.test/start");
 assert.equal(result.url,"https://example.test/start");
 assert.equal(result.redirected,false);
});

test("resource loader distinguishes caller cancellation from timeout",async()=>{
 const controller=new AbortController();
 const loader=new ResourceLoader({fetch:async(url,options)=>new Promise((resolve,reject)=>options.signal.addEventListener("abort",()=>reject(options.signal.reason),{once:true}))});
 const pending=loader.fetchText("https://example.test/",{signal:controller.signal});
 controller.abort(new Error("test cancellation"));
 await assert.rejects(pending,error=>error.code==="REQUEST_ABORTED");
});
