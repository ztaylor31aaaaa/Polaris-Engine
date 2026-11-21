import { HTMLParser } from "./html-parser.js";
import { StyleEngine } from "./style-engine.js";
import { LayoutEngine } from "./layout-engine.js";
import { PaintEngine } from "./paint-engine.js";
import { ElementNode } from "./document-model.js";
import { ResourceLoader } from "./resource-loader.js";
import { PolarisDocumentRuntime } from "./dom-runtime.js";
import { PolarisHistory } from "./history-runtime.js";
import { ImageResourceLoader } from "./image-loader.js";
import { RendererViewport } from "./viewport.js";
import { buildAccessibilityTree } from "./accessibility.js";
import { ScriptRuntime } from "./script-runtime.js";

export class PolarisRenderer {
  constructor(options={}){
    this.canvas=options.canvas??null;this.context=options.context??this.canvas?.getContext?.("2d")??null;
    this.parser=options.parser??new HTMLParser();this.styles=options.styleEngine??new StyleEngine();
    this.viewportState=new RendererViewport({width:options.width??this.canvas?.width??1024,height:options.height??this.canvas?.height??768});
    this.viewport={width:this.viewportState.width,height:this.viewportState.height};
    this.layoutEngine=options.layoutEngine??new LayoutEngine({measureText:(text,size,font)=>{if(this.context){this.context.save();this.context.font=`${size}px ${font??"Arial"}`;const width=this.context.measureText(String(text)).width;this.context.restore();return width;}return String(text).length*size*.52;}});
    this.painter=options.paintEngine??new PaintEngine(options);this.resourceLoader=options.resourceLoader??new ResourceLoader(options.resources);
    this.imageLoader=options.imageLoader??new ImageResourceLoader({resourceLoader:this.resourceLoader});this.images=new Map();
    this.scriptRuntime=options.scriptRuntime??(options.scriptEngine?new ScriptRuntime({engine:options.scriptEngine,resourceLoader:this.resourceLoader}):null);
    this.runtime=null;this.document=null;this.history=new PolarisHistory({onChange:entry=>{if(entry)this.loadURL(entry.url,{history:false}).catch(this.onError);}});
    this.onNavigate=options.onNavigate??null;this.onError=options.onError??(()=>{});
    this._clickHandler=e=>this._handlePointer(e,"click");this._pointerHandler=e=>this._handlePointer(e,"pointerdown");
    this.canvas?.addEventListener?.("click",this._clickHandler);this.canvas?.addEventListener?.("pointerdown",this._pointerHandler);
    this.viewportState.onChange(state=>{this.viewport={width:state.width,height:state.height};this.styles.setViewport(this.viewport);this.render();});
  }
  _installDocument(html,options={}){
    this.document=this.parser.parse(html,options);this.runtime=new PolarisDocumentRuntime({document:this.document,onNavigate:(url,navOptions)=>this.navigate(url,navOptions),onSubmit:(form)=>this._submitForm(form)});
    this.runtime.decorateTree();if(this.scriptRuntime)this.scriptRuntime.runtime=this.runtime;this.runtime.viewport=this.viewport;this.styles.setViewport(this.viewport);this.styles.clearStylesheets();
    for(const style of this.document.querySelectorAll("style"))this.styles.addStylesheet(style.textContent);
    this.history._navigate(this.document.url,null,options.replaceHistory??true);
    return this.document;
  }
  setHTML(html,options={}){this._installDocument(html,options);this.styles.compute(this.document);return this.render();}
  async loadURL(url,options={}){
    const target=this.resourceLoader.resolve(url,this.document?.url??"about:blank");
    const result=await this.resourceLoader.fetchText(target,{signal:options.signal,credentials:options.credentials});
    this._installDocument(result.text,{url:result.url,replaceHistory:options.history===false||options.replace===true});
    const links=this.document.querySelectorAll("link").filter(link=>(link.getAttribute("rel")??"").toLowerCase().split(/\s+/).includes("stylesheet")&&link.getAttribute("href"));
    const settled=await Promise.allSettled(links.map(link=>this.resourceLoader.fetchText(link.getAttribute("href"),{baseURL:result.url,signal:options.signal,credentials:options.credentials})));
    for(let i=0;i<settled.length;i++){const item=settled[i];if(item.status==="fulfilled")this.styles.addStylesheet(item.value.text);else this.onError(item.reason);}
    this.styles.compute(this.document);await this._loadImages(options);if(this.scriptRuntime&&options.executeScripts!==false)await this.startScripts(options);return this.render();
  }
  async _loadImages(options={}){
    this.images.clear();const images=this.document.querySelectorAll("img").filter(el=>el.getAttribute("src"));
    await Promise.allSettled(images.map(async el=>{const result=await this.imageLoader.load(el.getAttribute("src"),{baseURL:this.document.url,signal:options.signal,credentials:options.credentials});this.images.set(el,result);}));
    this.painter.images=this.images;
  }
  async startScripts(options={}){if(!this.scriptRuntime)throw new Error("No isolated ScriptRuntime has been configured");this.scriptRuntime.runtime=this.runtime;return this.scriptRuntime.start(this.document,options);}
  async _submitForm(form){try{const {encodeFormData}=await import("./forms.js");const request=encodeFormData(form,form.getAttribute("method")??"GET");this.navigate(request.url);}catch(error){this.onError(error);}}
  navigate(url,options={}){
    const resolved=this.resourceLoader.resolve(url,this.document?.url??"about:blank");
    if(options.replace)this.history.replaceState(options.state??null,"",resolved);else this.history.pushState(options.state??null,"",resolved);
    if(this.onNavigate)this.onNavigate(resolved,options);
    return resolved;
  }
  back(){return this.history.back();}
  forward(){return this.history.forward();}
  addStylesheet(css){this.styles.addStylesheet(css);if(this.document)this.styles.compute(this.document);return this.render();}
  resize(width,height,dpr){this.viewportState.resize(width,height,dpr);if(this.canvas){this.canvas.width=Math.round(width*(dpr??1));this.canvas.height=Math.round(height*(dpr??1));}return this.render();}
  scrollTo(x,y){this.viewportState.scrollTo(x,y);return this.render();}
  scrollBy(x,y){this.viewportState.scrollBy(x,y);return this.render();}
  hitTest(x,y){if(!this.document)return null;return [...this.document.walk()].filter(n=>n instanceof ElementNode).reverse().find(n=>{const b=n.layout;return b&&x>=b.x&&y>=b.y&&x<=b.x+b.width&&y<=b.y+b.height;})??null;}
  _handlePointer(event,type){
    if(!this.document||!this.canvas)return;
    const rect=this.canvas.getBoundingClientRect?.()??{left:0,top:0,width:this.viewport.width,height:this.viewport.height};
    const x=(event.clientX-rect.left)*(this.viewport.width/(rect.width||this.viewport.width)),y=(event.clientY-rect.top)*(this.viewport.height/(rect.height||this.viewport.height));
    const hit=this.hitTest(x,y);if(type==="pointerdown"){for(const node of this.document.querySelectorAll("*"))node._hover=false;if(hit)hit._hover=true;}if(!hit)return;
    const target=hit;const link=hit.tagName==="a"?hit:findAncestor(hit,"a");
    if(type==="click"&&link?.getAttribute("href")){event.preventDefault?.();this.navigate(link.getAttribute("href"));}
    const polarisEvent=this.runtime.createEvent(type,{bubbles:true,cancelable:true,detail:{clientX:x,clientY:y}});
    this.runtime.dispatch(target,polarisEvent);
    if(type==="click")target.dispatchEvent(this.runtime.createEvent("click",{bubbles:true,cancelable:true}));
  }
  getAccessibilityTree(){return this.document?buildAccessibilityTree(this.document):[];}
  render(){
    if(!this.document)return null;
    try{this.styles.compute(this.document);const layout=this.layoutEngine.layout(this.document,this.viewport);this.painter.images=this.images;return this.painter.paint(this.document,layout,this.context);}
    catch(error){this.onError(error);throw error;}
  }
  destroy(){this.canvas?.removeEventListener?.("click",this._clickHandler);this.canvas?.removeEventListener?.("pointerdown",this._pointerHandler);this.imageLoader.clear();this.scriptRuntime?.dispose?.();this.runtime=null;this.document=null;this.context=null;this.canvas=null;}
}
function findAncestor(node,tag){for(let current=node;current;current=current.parentNode)if(current instanceof ElementNode&&current.tagName===tag)return current;return null;}
