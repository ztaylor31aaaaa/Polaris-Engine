export class RendererViewport {
  constructor(options={}){this.width=Math.max(1,options.width??1024);this.height=Math.max(1,options.height??768);this.devicePixelRatio=Math.max(1,options.devicePixelRatio??1);this.scrollX=0;this.scrollY=0;this.listeners=new Set();}
  resize(width,height,dpr=this.devicePixelRatio){this.width=Math.max(1,width);this.height=Math.max(1,height);this.devicePixelRatio=Math.max(1,dpr);this._emit("resize");}
  scrollTo(x,y){this.scrollX=Math.max(0,x);this.scrollY=Math.max(0,y);this._emit("scroll");}
  scrollBy(x,y){this.scrollTo(this.scrollX+x,this.scrollY+y);}
  onChange(callback){this.listeners.add(callback);return()=>this.listeners.delete(callback);}
  _emit(type){const state={type,width:this.width,height:this.height,scrollX:this.scrollX,scrollY:this.scrollY,devicePixelRatio:this.devicePixelRatio};for(const fn of this.listeners)fn(state);}
  snapshot(){return {width:this.width,height:this.height,devicePixelRatio:this.devicePixelRatio,scrollX:this.scrollX,scrollY:this.scrollY};}
}
