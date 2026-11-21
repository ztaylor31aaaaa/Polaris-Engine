export class PolarisEvent {
  constructor(type,options={}) {
    if(!type) throw new TypeError("Event type is required");
    this.type=String(type); this.bubbles=options.bubbles ?? false; this.cancelable=options.cancelable ?? false;
    this.detail=options.detail; this.target=null; this.currentTarget=null; this.eventPhase=0;
    this.defaultPrevented=false; this.propagationStopped=false; this.immediatePropagationStopped=false;
    this.timeStamp=Date.now();
  }
  preventDefault(){if(this.cancelable)this.defaultPrevented=true;}
  stopPropagation(){this.propagationStopped=true;}
  stopImmediatePropagation(){this.immediatePropagationStopped=true;this.propagationStopped=true;}
}
export class PolarisCustomEvent extends PolarisEvent {
  constructor(type,options={}){super(type,options);this.detail=options.detail??null;}
}
export class EventTargetMixin {
  addEventListener(type,callback,options={}) {
    if(typeof callback!=="function"&&typeof callback?.handleEvent!=="function")return;
    const capture=typeof options==="boolean"?options:Boolean(options?.capture);
    const once=Boolean(options?.once), signal=typeof options==="object"?options.signal:null;
    if(signal?.aborted)return;
    this._eventListeners??=new Map();
    const list=this._eventListeners.get(type)??[];
    if(list.some(item=>item.callback===callback&&item.capture===capture))return;
    const entry={callback,capture,once,signal,abort:null};
    if(signal){entry.abort=()=>this.removeEventListener(type,callback,{capture});signal.addEventListener("abort",entry.abort,{once:true});}
    list.push(entry);this._eventListeners.set(type,list);
  }
  removeEventListener(type,callback,options={}) {
    const capture=typeof options==="boolean"?options:Boolean(options?.capture),list=this._eventListeners?.get(type);
    if(!list)return;
    const index=list.findIndex(item=>item.callback===callback&&item.capture===capture);
    if(index>=0){const [entry]=list.splice(index,1);entry.signal?.removeEventListener("abort",entry.abort);}
  }
  _invokeListeners(event,capture) {
    const list=[...(this._eventListeners?.get(event.type)??[])];
    for(const entry of list){
      if(entry.capture!==capture)continue;
      if(entry.once)this.removeEventListener(event.type,entry.callback,{capture});
      if(typeof entry.callback==="function")entry.callback.call(this,event);else entry.callback.handleEvent(event);
      if(event.immediatePropagationStopped)break;
    }
  }
}
export function dispatchPolarisEvent(target,event) {
  if(!(event instanceof PolarisEvent))throw new TypeError("Expected a PolarisEvent");
  if(event.target)throw new Error("An event cannot be dispatched twice");
  event.target=target;
  const path=[];for(let node=target;node;node=node.parentNode)path.push(node);
  for(let i=path.length-1;i>0&&!event.propagationStopped;i--){event.currentTarget=path[i];event.eventPhase=1;path[i]._invokeListeners?.(event,true);}
  if(!event.propagationStopped){event.currentTarget=target;event.eventPhase=2;target._invokeListeners?.(event,true);if(!event.immediatePropagationStopped)target._invokeListeners?.(event,false);}
  if(event.bubbles&&!event.propagationStopped)for(let i=1;i<path.length&&!event.propagationStopped;i++){event.currentTarget=path[i];event.eventPhase=3;path[i]._invokeListeners?.(event,false);}
  event.currentTarget=null;event.eventPhase=0;
  return !event.defaultPrevented;
}
