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
    this.handlers=new Map();this.sequence=0;this.closed=false;
    this.allowedMethods=new Set(["createElement","getAttribute","setAttribute","removeAttribute","appendText","appendChild","removeChild","setTextContent","getTextContent","setStyle","querySelector","querySelectorAll","dispatchEvent"]);
    this.handlers.set("createElement",args=>this.runtime.createElement(args.tagName).nodeId);
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
  }
  register(method,handler){if(!this.allowedMethods.has(method)||typeof handler!=="function")throw new TypeError("Unsupported bridge method");this.handlers.set(method,handler);return()=>this.handlers.delete(method);}
  _element(nodeId){for(const node of this.runtime.document.walk())if(node.nodeId===nodeId)return node;throw new Error("Unknown document node");}
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
  close(){this.closed=true;this.handlers.clear();}
}
