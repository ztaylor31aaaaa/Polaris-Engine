import { ResourceLoader } from "./resource-loader.js";
import { PolarisDOMBridge } from "./script-bridge-extended.js";
import { PolarisDocumentRuntime } from "./dom-runtime.js";

/**
 * Runs page scripts only through a host-provided isolated engine adapter.
 * Polaris never evaluates page source in its own JavaScript realm.
 *
 * Adapter contract:
 *   await engine.createContext({ bridge, permissions, limits })
 *   await context.evaluate(source, { filename, timeoutMs })
 *   await context.dispose()
 */
export class ScriptRuntime {
  constructor(options={}){
    this.engine=options.engine??null;
    this.resourceLoader=options.resourceLoader??new ResourceLoader(options.resources);
    this.runtime=options.documentRuntime??null;
    this.timeoutMs=options.timeoutMs??1000;
    this.maxScriptBytes=options.maxScriptBytes??1024*1024;
    this.permissions=Object.freeze([...(options.permissions??["dom:read","dom:write","events"])]);
    this.context=null;this.bridge=null;this.running=false;this.disposed=false;
    this.onScript=options.onScript??(()=>{});this.onError=options.onError??(()=>{});
  }
  async start(document=this.runtime?.document,options={}){
    if(this.disposed)throw new Error("ScriptRuntime has been disposed");
    if(!this.engine||typeof this.engine.createContext!=="function")throw new Error("A separately isolated JavaScript engine adapter is required");
    if(!document)throw new Error("A Polaris document is required");
    if(this.running)throw new Error("ScriptRuntime is already running");
    this.running=true;
    this.runtime=this.runtime??new PolarisDocumentRuntime({document});
    this.runtime.decorateTree();
    this.bridge=new PolarisDOMBridge({runtime:this.runtime,maxMessageBytes:options.maxBridgeMessageBytes});
    try{
      this.context=await this.engine.createContext({
        bridge:this.bridge,
        permissions:this.permissions,
        limits:{timeoutMs:this.timeoutMs,maxScriptBytes:this.maxScriptBytes,memoryBytes:options.memoryBytes??32*1024*1024}
      });
      const scripts=document.querySelectorAll("script");
      const results=[];
      for(let index=0;index<scripts.length;index++){
        const element=scripts[index],type=(element.getAttribute("type")??"").trim().toLowerCase();
        if(type&&type!=="text/javascript"&&type!=="application/javascript"&&type!=="module")continue;
        if(type==="module"){this.onError(new Error("JavaScript modules are not supported by this script adapter yet"));continue;}
        let source=element.textContent,filename=document.url+"#inline-"+index;
        if(element.getAttribute("src")){
          filename=this.resourceLoader.resolve(element.getAttribute("src"),document.url);
          try{source=(await this.resourceLoader.fetchText(filename,{signal:options.signal,credentials:options.credentials})).text;}
          catch(error){this.onError(error);continue;}
        }
        const size=new TextEncoder().encode(source).byteLength;
        if(size>this.maxScriptBytes){this.onError(new Error("Script exceeds configured size limit: "+filename));continue;}
        try{
          const result=await this.context.evaluate(source,{filename,timeoutMs:this.timeoutMs});
          results.push({filename,ok:true,result});this.onScript({filename,index,ok:true});
        }catch(error){results.push({filename,ok:false,error});this.onError(error);this.onScript({filename,index,ok:false,error});}
      }
      return results;
    }finally{this.running=false;}
  }
  async evaluate(source,options={}){
    if(!this.context)throw new Error("ScriptRuntime has not been started");
    const text=String(source),size=new TextEncoder().encode(text).byteLength;
    if(size>this.maxScriptBytes)throw new Error("Script exceeds configured size limit");
    return this.context.evaluate(text,{filename:options.filename??"polaris:eval",timeoutMs:options.timeoutMs??this.timeoutMs});
  }
  async dispose(){
    if(this.disposed)return;
    this.disposed=true;this.bridge?.close();
    try{await this.context?.dispose?.();}finally{this.context=null;this.bridge=null;}
  }
}
