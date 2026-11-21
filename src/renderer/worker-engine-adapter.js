/**
 * Host-side RPC adapter for a dedicated JavaScript engine worker.
 * The worker must implement the Polaris worker protocol; this adapter never
 * evaluates page source in the Polaris application realm.
 */
export class WorkerEngineAdapter {
  constructor(options={}){
    if(typeof options.workerFactory!=="function")throw new TypeError("workerFactory is required");
    this.workerFactory=options.workerFactory;this.timeoutMs=options.timeoutMs??5000;
    this.maxMessageBytes=options.maxMessageBytes??2*1024*1024;this.onLog=options.onLog??(()=>{});
    this.worker=null;this.pending=new Map();this.sequence=0;this.closed=false;this.bridge=null;
  }
  async createContext(options={}){
    if(this.closed)throw new Error("Worker engine adapter is closed");
    if(!this.worker){
      this.worker=this.workerFactory();
      if(!this.worker?.postMessage)throw new TypeError("workerFactory must return a Worker-like object");
      this.worker.addEventListener?.("message",event=>this._receive(event.data));
      this.worker.addEventListener?.("error",event=>this._failAll(new Error(event.message??"Script worker failed")));
      if(!this.worker.addEventListener){this.worker.onmessage=event=>this._receive(event.data);this.worker.onerror=event=>this._failAll(new Error(event.message??"Script worker failed"));}
    }
    this.bridge=options.bridge;
    const result=await this._request("create-context",{permissions:options.permissions??[],limits:options.limits??{}},options.limits?.timeoutMs);
    if(!result?.contextId)throw new Error("Script worker did not return a contextId");
    return new WorkerScriptContext(this,result.contextId);
  }
  _request(type,payload={},timeout=this.timeoutMs){
    if(this.closed||!this.worker)return Promise.reject(new Error("Script worker is unavailable"));
    const id=++this.sequence,message={channel:"polaris-script",type,id,...payload};
    const size=JSON.stringify(message).length;if(size>this.maxMessageBytes)return Promise.reject(new Error("Script worker message exceeds size limit"));
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error("Script worker request timed out"));},timeout??this.timeoutMs);
      this.pending.set(id,{resolve,reject,timer});
      try{this.worker.postMessage(message);}catch(error){clearTimeout(timer);this.pending.delete(id);reject(error);}
    });
  }
  async _receive(message){
    if(!message||message.channel!=="polaris-script")return;
    if(message.type==="bridge-call"){
      try{const result=await this.bridge.handle(message.request);this.worker?.postMessage({channel:"polaris-script",type:"bridge-result",id:message.id,result});}
      catch(error){this.worker?.postMessage({channel:"polaris-script",type:"bridge-result",id:message.id,error:String(error?.message??error)});}
      return;
    }
    if(message.type==="log"){this.onLog(message);return;}
    const pending=this.pending.get(message.id);if(!pending)return;
    clearTimeout(pending.timer);this.pending.delete(message.id);
    if(message.type==="error")pending.reject(new Error(message.error??"Script worker error"));
    else pending.resolve(message.result);
  }
  _failAll(error){for(const item of this.pending.values()){clearTimeout(item.timer);item.reject(error);}this.pending.clear();}
  async close(){
    if(this.closed)return;this.closed=true;this._failAll(new Error("Script worker closed"));
    try{this.worker?.terminate?.();}finally{this.worker=null;this.bridge=null;}
  }
}
class WorkerScriptContext {
  constructor(adapter,contextId){this.adapter=adapter;this.contextId=contextId;this.disposed=false;}
  async evaluate(source,options={}){
    if(this.disposed)throw new Error("Script context is disposed");
    const text=String(source),size=new TextEncoder().encode(text).byteLength;
    if(size>(this.adapter.maxMessageBytes-2048))throw new Error("Script source exceeds worker message limit");
    return this.adapter._request("evaluate",{contextId:this.contextId,source:text,filename:options.filename??"polaris:script",timeoutMs:options.timeoutMs??this.adapter.timeoutMs},options.timeoutMs);
  }
  async dispose(){
    if(this.disposed)return;this.disposed=true;
    await this.adapter._request("dispose-context",{contextId:this.contextId}).catch(()=>{});
  }
}
