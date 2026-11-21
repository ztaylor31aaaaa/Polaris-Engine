const WEB_PROTOCOLS = new Set(["http:","https:"]);
export class ResourceLoadError extends Error {
  constructor(message, code, url, cause) { super(message,{cause}); this.name="ResourceLoadError"; this.code=code; this.url=url; }
}
export class ResourceLoader {
  constructor(options={}) {
    this.fetch=options.fetch ?? globalThis.fetch?.bind(globalThis);
    this.timeout=options.timeout ?? 15000;
    this.maxBytes=options.maxBytes ?? 5*1024*1024;
    this.headers={...(options.headers ?? {})};
    this.policy=options.policy??null;
    if(typeof this.fetch!=="function") throw new Error("Fetch is unavailable");
  }
  resolve(reference,base="about:blank") {
    let url;
    try { url=new URL(reference,base); } catch(error) { throw new ResourceLoadError("Invalid resource URL","INVALID_URL",String(reference),error); }
    if(!WEB_PROTOCOLS.has(url.protocol)) throw new ResourceLoadError("Only HTTP and HTTPS resources are supported","UNSUPPORTED_SCHEME",url.href);
    return url.href;
  }
  async fetchResponse(reference,options={}) {
    const url=this.resolve(reference,options.baseURL);
    this.policy?.check(url,{method:"GET",credentials:options.credentials??"same-origin"});
    const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(new Error("Resource request timed out")),options.timeout ?? this.timeout);
    const external=options.signal;
    const abort=()=>controller.abort(external.reason);
    if(external?.aborted) abort(); else external?.addEventListener("abort",abort,{once:true});
    try {
      const response=await this.fetch(url,{method:"GET",headers:{...this.headers,...options.headers},signal:controller.signal,credentials:options.credentials ?? "same-origin",mode:"cors",redirect:"follow"});
      if(!response.ok) throw new ResourceLoadError(`Resource request failed with HTTP ${response.status}`,"HTTP_ERROR",url);
      const declared=Number(response.headers?.get?.("content-length") ?? 0);
      if(declared>this.maxBytes) throw new ResourceLoadError("Resource exceeds configured size limit","TOO_LARGE",url);
      return {response,url};
    } catch(error) {
      if(error instanceof ResourceLoadError) throw error;
      if(controller.signal.aborted) throw new ResourceLoadError("Resource request was aborted or timed out","ABORTED",url,error);
      throw new ResourceLoadError("Fetch failed. Check CORS permissions, network connectivity, DNS, TLS, and browser request policies.","CORS_OR_NETWORK_ERROR",url,error);
    } finally {
      clearTimeout(timeout); external?.removeEventListener("abort",abort);
    }
  }
  async _readBytes(response,url){
    if(response.body?.getReader){
      const reader=response.body.getReader(),chunks=[];let total=0;
      try{
        while(true){
          const {done,value}=await reader.read();if(done)break;
          total+=value.byteLength;
          if(total>this.maxBytes){await reader.cancel();throw new ResourceLoadError("Resource exceeds configured size limit","TOO_LARGE",url);}
          chunks.push(value);
        }
      }catch(error){if(error instanceof ResourceLoadError)throw error;throw new ResourceLoadError("Unable to read resource body","READ_ERROR",url,error);}
      const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
    }
    const bytes=new Uint8Array(await response.arrayBuffer());
    if(bytes.byteLength>this.maxBytes)throw new ResourceLoadError("Resource exceeds configured size limit","TOO_LARGE",url);
    return bytes;
  }
  async fetchText(reference,options={}){
    const {response,url}=await this.fetchResponse(reference,options);
    const bytes=await this._readBytes(response,url);
    return {text:new TextDecoder(options.encoding??"utf-8").decode(bytes),url,contentType:response.headers?.get?.("content-type")??"text/plain"};
  }
  async fetchBytes(reference,options={}){
    const {response,url}=await this.fetchResponse(reference,options);
    const bytes=await this._readBytes(response,url);
    return {bytes,url,contentType:response.headers?.get?.("content-type")??"application/octet-stream"};
  }
}
