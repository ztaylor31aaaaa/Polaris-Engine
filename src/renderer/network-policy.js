const SAFE_METHODS=new Set(["GET","HEAD","OPTIONS"]);
export class RendererNetworkPolicy {
  constructor(options={}){this.allowedOrigins=options.allowedOrigins?new Set(options.allowedOrigins):null;this.allowCredentials=options.allowCredentials??false;this.maxRedirects=options.maxRedirects??10;}
  check(url,options={}){
    const parsed=new URL(url),method=String(options.method??"GET").toUpperCase();
    if(!["http:","https:"].includes(parsed.protocol))throw new Error("Renderer network policy only permits HTTP and HTTPS");
    if(this.allowedOrigins&&!this.allowedOrigins.has(parsed.origin))throw new Error("Origin is not permitted by renderer policy");
    if(!SAFE_METHODS.has(method)&&options.allowUnsafeMethods!==true)throw new Error("Non-read-only requests require explicit host permission");
    if(options.credentials==="include"&&!this.allowCredentials)throw new Error("Credentialed cross-origin requests are disabled by renderer policy");
    return {url:parsed.href,method,credentials:options.credentials??"same-origin"};
  }
}
