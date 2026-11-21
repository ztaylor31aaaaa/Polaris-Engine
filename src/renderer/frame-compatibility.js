import { PolarisRenderer } from "./renderer.js";

/**
 * Frame-shaped compatibility facade backed by PolarisRenderer, not an iframe.
 * This provides a deliberately small browser-like surface for migrated app
 * controllers. It does not impersonate a native Window or bypass web security.
 */
export class PolarisFrameCompatibility {
  constructor(options={}) {
    this.renderer=options.renderer??new PolarisRenderer(options);
    this.frame=this.renderer.canvas??null;
    this.listeners=new Map();this.closed=false;this._url="about:blank";
    this.documentFacade=this._createDocumentFacade();
    this.location=this._createLocationFacade();
    this.history=this._createHistoryFacade();
    this.window=this._createWindowFacade();
    this.navigator=Object.freeze({userAgent:"PolarisRenderer/0.1",platform:"Polaris",language:globalThis.navigator?.language??"en",onLine:globalThis.navigator?.onLine??true});
    this.screen=Object.freeze({width:this.renderer.viewport.width,height:this.renderer.viewport.height});
  }
  get document(){return this.documentFacade}
  get contentWindow(){return this.window}
  get contentDocument(){return this.documentFacade}
  get url(){return this._url}
  async load(url,options={}){this._assertOpen();const result=await this.renderer.loadURL(url,options);this._url=this.renderer.document?.url??String(url);this._emit("load",{url:this._url});return result;}
  async go(url,options={}){return this.load(url,options);}
  reload(options={}){this._assertOpen();if(!this._url||this._url==="about:blank")return Promise.resolve(null);return this.load(this._url,{...options,replace:true});}
  focus(){this.frame?.focus?.();}
  blur(){this.frame?.blur?.();}
  getBoundingClientRect(){return this.frame?.getBoundingClientRect?.()??{x:0,y:0,width:this.renderer.viewport.width,height:this.renderer.viewport.height,top:0,left:0,right:this.renderer.viewport.width,bottom:this.renderer.viewport.height};}
  setHTML(html,options={}){this._assertOpen();const result=this.renderer.setHTML(html,{url:options.url??"polaris:document"});this._url=this.renderer.document?.url??this._url;this._emit("load",{url:this._url});return result;}
  navigate(url,options={}){this._assertOpen();const resolved=this.renderer.navigate(url,options);this._url=resolved;this._emit("navigate",{url:resolved});return resolved;}
  resize(width,height,dpr){this._assertOpen();return this.renderer.resize(width,height,dpr);}
  addEventListener(type,listener){if(typeof listener!=="function")return;const list=this.listeners.get(type)??new Set();list.add(listener);this.listeners.set(type,list);}
  removeEventListener(type,listener){this.listeners.get(type)?.delete(listener);}
  dispatchEvent(event){this._emit(event.type,event);return true;}
  _emit(type,detail={}){for(const listener of this.listeners.get(type)??[])try{listener({type,target:this,detail});}catch(error){queueMicrotask(()=>{throw error;});}}
  _createDocumentFacade(){
    const frame=this;
    return Object.freeze({
      get documentElement(){return frame.renderer.document?.documentElement??null;},
      get body(){return frame.renderer.document?.body??null;},
      get title(){return frame.renderer.document?.querySelector("title")?.textContent??"";},
      get URL(){return frame._url;},
      get readyState(){return frame.renderer.document?"complete":"loading";},
      getElementById(id){return frame.renderer.document?.getElementById(id)??null;},
      querySelector(selector){return frame.renderer.document?.querySelector(selector)??null;},
      querySelectorAll(selector){return frame.renderer.document?.querySelectorAll(selector)??[];},
      createElement(tag){return frame.renderer.runtime?.createElement(tag)??null;},
      createTextNode(text){return frame.renderer.runtime?.createTextNode(text)??null;},
      get activeElement(){return frame.renderer.runtime?.activeElement??null;}
    });
  }
  _createLocationFacade(){
    const frame=this;
    return Object.freeze({
      get href(){return frame._url;},get origin(){try{return new URL(frame._url).origin}catch{return "null"}},
      get protocol(){try{return new URL(frame._url).protocol}catch{return ""}},
      get host(){try{return new URL(frame._url).host}catch{return ""}},
      get hostname(){try{return new URL(frame._url).hostname}catch{return ""}},
      get pathname(){try{return new URL(frame._url).pathname}catch{return ""}},
      assign(url){return frame.navigate(url);},replace(url){return frame.navigate(url,{replace:true});},
      toString(){return frame._url}
    });
  }
  _createHistoryFacade(){
    const frame=this;
    return Object.freeze({
      get length(){return frame.renderer.history?.entries?.length??0;},
      back(){return frame.renderer.back();},forward(){return frame.renderer.forward();},
      pushState(state,title,url){return frame.navigate(url??frame._url,{state});},
      replaceState(state,title,url){return frame.navigate(url??frame._url,{state,replace:true});}
    });
  }
  _createWindowFacade(){
    const frame=this;
    return Object.freeze({
      get document(){return frame.documentFacade;},get location(){return frame.location;},
      get history(){return frame.history;},get navigator(){return frame.navigator;},get screen(){return frame.screen;},
      get innerWidth(){return frame.renderer.viewport.width;},get innerHeight(){return frame.renderer.viewport.height;},
      get parent(){return frame.window;},get self(){return frame.window;},get top(){return frame.window;},
      addEventListener:(...args)=>frame.addEventListener(...args),removeEventListener:(...args)=>frame.removeEventListener(...args),
      dispatchEvent:event=>frame.dispatchEvent(event),
      scrollTo:(x,y)=>frame.renderer.scrollTo(x,y),scrollBy:(x,y)=>frame.renderer.scrollBy(x,y),
      getComputedStyle:element=>frame.renderer.styles.getComputedStyle?.(element)??element?.computedStyle??{},
      requestAnimationFrame:callback=>requestAnimationFrame(callback),cancelAnimationFrame:id=>cancelAnimationFrame(id),
      setTimeout:(...args)=>setTimeout(...args),clearTimeout:id=>clearTimeout(id)
    });
  }
  _assertOpen(){if(this.closed)throw new Error("Polaris frame compatibility instance is destroyed");}
  destroy(){if(this.closed)return;this.closed=true;this.renderer.destroy();this.listeners.clear();}
}

export function createPolarisFrame(options={}){return new PolarisFrameCompatibility(options);}
