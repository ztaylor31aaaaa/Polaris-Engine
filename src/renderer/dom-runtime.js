import { DocumentNode,ElementNode,TextNode,CommentNode,PolarisNode } from "./document-model.js";
import { PolarisEvent,PolarisCustomEvent,EventTargetMixin,dispatchPolarisEvent } from "./dom-events.js";

export class PolarisDocumentRuntime extends EventTargetMixin {
  constructor(options={}) {
    super();this.document=options.document??new DocumentNode();this.mutationObservers=new Set();
    this.activeElement=null;this.onNavigate=options.onNavigate??(()=>{});this.onSubmit=options.onSubmit??(()=>{});
    this._installDocumentMethods();
  }
  _installDocumentMethods(){
    const doc=this.document;
    doc.createElement=tag=>this.createElement(tag);
    doc.createTextNode=text=>new TextNode(text);
    doc.createComment=text=>new CommentNode(text);
    doc.getElementById=id=>doc.querySelector("#"+String(id).replace(/([^\w-])/g,"\\$1"));
    doc.activeElement=this.activeElement;
    doc.addEventListener=(...args)=>EventTargetMixin.prototype.addEventListener.apply(doc,args);
    doc.removeEventListener=(...args)=>EventTargetMixin.prototype.removeEventListener.apply(doc,args);
    doc._invokeListeners=(...args)=>EventTargetMixin.prototype._invokeListeners.apply(doc,args);\n    doc.dispatchEvent=event=>dispatchPolarisEvent(doc,event);
    doc.defaultView=this.window;
  }
  createElement(tag){const el=new ElementNode(tag);this._decorateElement(el);return el;}
  createTextNode(text){return new TextNode(text);}
  createEvent(type,options){return new PolarisEvent(type,options);}
  createCustomEvent(type,options){return new PolarisCustomEvent(type,options);}
  observe(observer){this.mutationObservers.add(observer);return()=>this.mutationObservers.delete(observer);}
  notifyMutation(record){for(const observer of this.mutationObservers)observer._enqueue(record);}
  append(parent,node){parent.appendChild(node);this.notifyMutation({type:"childList",target:parent,addedNodes:[node],removedNodes:[]});return node;}
  remove(parent,node){parent.removeChild(node);this.notifyMutation({type:"childList",target:parent,addedNodes:[],removedNodes:[node]});return node;}
  setAttribute(element,name,value){const oldValue=element.getAttribute(name);element.setAttribute(name,value);this.notifyMutation({type:"attributes",target:element,attributeName:name,oldValue});}
  setText(node,value){const oldValue=node.textContent;node.textContent=value;this.notifyMutation({type:"characterData",target:node,oldValue});}
  dispatch(target,event){return dispatchPolarisEvent(target,event);}
  focus(element){if(this.activeElement===element)return;this.activeElement?.dispatchEvent?.(new PolarisEvent("blur"));this.activeElement=element;this.document.activeElement=element;element?.dispatchEvent?.(new PolarisEvent("focus"));}
  blur(element){if(this.activeElement!==element)return;this.activeElement=null;this.document.activeElement=null;element.dispatchEvent(new PolarisEvent("blur"));}
  submit(form,submitter=null){const event=new PolarisEvent("submit",{bubbles:true,cancelable:true,detail:{submitter}});const accepted=this.dispatch(form,event);if(accepted)this.onSubmit(form,submitter);return accepted;}
  _decorateElement(el){
    el.ownerDocument=this.document;
    el.addEventListener=(...args)=>EventTargetMixin.prototype.addEventListener.apply(el,args);
    el.removeEventListener=(...args)=>EventTargetMixin.prototype.removeEventListener.apply(el,args);
    el.dispatchEvent=event=>dispatchPolarisEvent(el,event);
    el.click=()=>this.dispatch(el,new PolarisEvent("click",{bubbles:true,cancelable:true}));
    el.focus=()=>this.focus(el);el.blur=()=>this.blur(el);
    Object.defineProperty(el,"value",{get(){return this._value??this.getAttribute("value")??"";},set(v){this._value=String(v);}});
    Object.defineProperty(el,"checked",{get(){return Boolean(this._checked??this.hasAttribute("checked"));},set(v){this._checked=Boolean(v);}});
    Object.defineProperty(el,"disabled",{get(){return this.hasAttribute("disabled");},set(v){v?this.setAttribute("disabled",""):this.removeAttribute("disabled");}});
    Object.defineProperty(el,"href",{get(){return this.getAttribute("href")??"";},set(v){this.setAttribute("href",v);}});
    Object.defineProperty(el,"src",{get(){return this.getAttribute("src")??"";},set(v){this.setAttribute("src",v);}});
    Object.defineProperty(el,"name",{get(){return this.getAttribute("name")??"";},set(v){this.setAttribute("name",v);}});
    Object.defineProperty(el,"type",{get(){return this.getAttribute("type")??"";},set(v){this.setAttribute("type",v);}});
    Object.defineProperty(el,"dataset",{get(){const out={};for(const [key,value] of this.attributes)if(key.startsWith("data-"))out[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;return out;}});
    el.getBoundingClientRect=()=>{const b=el.layout??{};return {x:b.x??0,y:b.y??0,left:b.x??0,top:b.y??0,width:b.width??0,height:b.height??0,right:(b.x??0)+(b.width??0),bottom:(b.y??0)+(b.height??0),toJSON(){return {...this};}};};
    return el;
  }
  decorateTree(){for(const node of this.document.walk())if(node instanceof ElementNode)this._decorateElement(node);return this.document;}
  get window(){
    if(this._window)return this._window;
    const runtime=this;
    this._window={document:this.document,Event:PolarisEvent,CustomEvent:PolarisCustomEvent,Node:PolarisNode,Element:ElementNode,Text:TextNode,
      get location(){return {href:runtime.document.url,assign:url=>runtime.onNavigate(url),replace:url=>runtime.onNavigate(url,{replace:true})};},
      get innerWidth(){return runtime.viewport?.width??1024;},get innerHeight(){return runtime.viewport?.height??768;},
      requestAnimationFrame(callback){return setTimeout(()=>callback(Date.now()),16);},cancelAnimationFrame(id){clearTimeout(id);},
      setTimeout,clearTimeout,setInterval,clearInterval,
      getComputedStyle(element){return {...element.computedStyle};},
      addEventListener:(...args)=>EventTargetMixin.prototype.addEventListener.apply(runtime,args),
      removeEventListener:(...args)=>EventTargetMixin.prototype.removeEventListener.apply(runtime,args),
      dispatchEvent:event=>dispatchPolarisEvent(runtime,event)
    };
    this._window.window=this._window;this._window.self=this._window;this._window.top=this._window;return this._window;
  }
}
export class PolarisMutationObserver {
  constructor(callback){if(typeof callback!=="function")throw new TypeError("MutationObserver callback must be a function");this.callback=callback;this.records=[];this.disconnectors=[];this.scheduled=false;}
  observe(runtime,target,options={}){if(!(runtime instanceof PolarisDocumentRuntime))throw new TypeError("Use a PolarisDocumentRuntime");const disconnect=runtime.observe(this);this.disconnectors.push(disconnect);this.options=options;this.target=target;}
  _enqueue(record){if(record.target!==this.target&&(!this.options?.subtree||!this.target?.contains?.(record.target)))return;if(record.type==="attributes"&&!this.options?.attributes)return;if(record.type==="childList"&&!this.options?.childList)return;if(record.type==="characterData"&&!this.options?.characterData)return;this.records.push(record);if(!this.scheduled){this.scheduled=true;queueMicrotask(()=>{this.scheduled=false;const records=this.takeRecords();if(records.length)this.callback(records,this);});}}
  takeRecords(){const records=this.records;this.records=[];return records;}
  disconnect(){for(const fn of this.disconnectors)fn();this.disconnectors=[];this.records=[];}
}
