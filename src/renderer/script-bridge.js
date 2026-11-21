import { PolarisDocumentRuntime } from "./dom-runtime.js";

/**
 * A message-only boundary for a separately hosted JavaScript engine.
 * This module deliberately does not eval, Function-compile, or execute page source.
 * A QuickJS/WASM or other isolated engine can connect through this protocol later.
 */
export class PolarisScriptBridge {
  constructor(options={}){
    this.runtime=options.runtime??new PolarisDocumentRuntime(options);
    this.maxMessageBytes=options.maxMessageBytes??256*1024;
    this.handlers=new Map();this.createdNodes=new Map();this.eventSubscriptions=new Map();this.pendingEvents=[];this.sequence=0;this.closed=false;
    this.allowedMethods=new Set(["createElement","getAttribute","setAttribute","removeAttribute","appendText","appendChild","removeChild","setTextContent","getTextContent","setStyle","querySelector","querySelectorAll","dispatchEvent","addEventListener","removeEventListener"]);
    this.handlers.set("createElement",args=>{const element=this.runtime.createElement(args.tagName);this.createdNodes.set(element.nodeId,element);return element.nodeId;});
    this.handlers.set("getAttribute",args=>this._element(args.nodeId).getAttribute(args.name));
    this.handlers.set("setAttribute",args=>{this.runtime.setAttribute(this._element(args.nodeId),args.name,args.value);return true;});
    this.handlers.set("removeAttribute",args=>{this._element(args.nodeId).removeAttribute(args.name);return true;});
    this.handlers.set("appendChild",args=>this.runtime.append(this._element(args.parentId),this._element(args.childId)).nodeId);
    this.handlers.set("removeChild",args=>this.runtime.remove(this._element(args.parentId),this._element(args.childId)).nodeId);
    this.handlers.set("appendText",args=>{const el=this._element(args.nodeId);return this.runtime.append(el,new (this.runtime.document.createTextNode("").constructor)(args.text)).nodeId;});
    this.handlers.set("setTextContent",args=>{this.runtime.setText(this._element(args.nodeId),args.value);return true;});
    this.handlers.set("getTextContent",args=>this._element(args.nodeId).textContent);
    this.handlers.set("setStyle",args=>{this._element(args.nodeId).style.setProperty(args.property,args.value,args.priority??"");return true;});
    this.handlers.set("querySelector",args=>this._element(args.nodeId).querySelector(args.selector)?.nodeId??null);
    this.handlers.set("querySelectorAll",args=>this._element(args.nodeId).querySelectorAll(args.selector).map(node=>node.nodeId));
    this.handlers.set("dispatchEvent",args=>this.runtime.dispatch(this._element(args.nodeId),this.runtime.createEvent(args.type,{bubbles:Boolean(args.bubbles),cancelable:Boolean(args.cancelable)})));
    this.handlers.set("addEventListener",args=>{
      const element=this._element(args.nodeId),key=String(args.listenerId);
      if(this.eventSubscriptions.has(key))return true;
      if(this.eventSubscriptions.size>=500)throw new Error("Event subscription limit reached");
      const callback=event=>{if(this.pendingEvents.length<1000)this.pendingEvents.push({listenerId:key,type:event.type,targetNodeId:event.target?.nodeId??null,currentTargetNodeId:event.currentTarget?.nodeId??null,defaultPrevented:event.defaultPrevented,detail:event.detail??null});};
      element.addEventListener(args.eventType,callback,{once:Boolean(args.once),capture:Boolean(args.capture)});
      this.eventSubscriptions.set(key,{element,eventType:args.eventType,callback,capture:Boolean(args.capture)});return true;
    });
    this.handlers.set("removeEventListener",args=>{
      const key=String(args.listenerId),entry=this.eventSubscriptions.get(key);
      if(entry){entry.element.removeEventListener(entry.eventType,entry.callback,{capture:entry.capture});this.eventSubscriptions.delete(key);}return true;
    });
  }
  register(method,handler){if(!this.allowedMethods.has(method)||typeof handler!=="function")throw new TypeError("Unsupported bridge method");this.handlers.set(method,handler);return()=>this.handlers.delete(method);}
  _element(nodeId){const created=this.createdNodes.get(nodeId);if(created)return created;for(const node of this.runtime.document.walk())if(node.nodeId===nodeId)return node;throw new Error("Unknown document node");}
  _rememberNode(node){this.createdNodes.set(node.nodeId,node);return node.nodeId;}
  _resolveNode(nodeId){return this._element(nodeId);}
  async handle(message){
    if(this.closed)throw new Error("Script bridge is closed");
    const size=JSON.stringify(message??null).length;if(size>this.maxMessageBytes)throw new Error("Bridge message exceeds size limit");
    if(!message||message.type!=="call"||!Number.isSafeInteger(message.id)||typeof message.method!=="string")throw new TypeError("Invalid bridge request");
    if(!this.allowedMethods.has(message.method))return {type:"error",id:message.id,error:"Method is not permitted"};
    const handler=this.handlers.get(message.method);if(!handler)return {type:"error",id:message.id,error:"Method is unavailable"};
    try{return {type:"result",id:message.id,result:await handler(message.args??{})};}
    catch(error){return {type:"error",id:message.id,error:String(error?.message??error)};}
  }
  createRequest(method,args={}){return {type:"call",id:++this.sequence,method,args};}
  drainEvents(){const events=this.pendingEvents;this.pendingEvents=[];return events;}
  close(){this.closed=true;for(const entry of this.eventSubscriptions.values())entry.element.removeEventListener(entry.eventType,entry.callback,{capture:entry.capture});this.eventSubscriptions.clear();this.pendingEvents=[];this.handlers.clear();}
}
