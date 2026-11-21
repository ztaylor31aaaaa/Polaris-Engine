import { HTMLParser } from "./html-parser.js";
import { StyleEngine } from "./style-engine.js";
import { LayoutEngine } from "./layout-engine.js";
import { PaintEngine } from "./paint-engine.js";
import { ElementNode } from "./document-model.js";

export class PolarisRenderer {
  constructor(options = {}) {
    this.canvas=options.canvas ?? null;
    this.context=options.context ?? this.canvas?.getContext?.("2d") ?? null;
    this.parser=options.parser ?? new HTMLParser();
    this.styles=options.styleEngine ?? new StyleEngine();
    this.layoutEngine=options.layoutEngine ?? new LayoutEngine({measureText:(text,size,font)=>{
      if (this.context) { this.context.save(); this.context.font=` ${size}px ${font ?? "Arial"}`; const width=this.context.measureText(String(text)).width; this.context.restore(); return width; }
      return String(text).length*size*0.52;
    }});
    this.painter=options.paintEngine ?? new PaintEngine(options);
    this.document=null;
    this.viewport={width:options.width ?? this.canvas?.width ?? 1024,height:options.height ?? this.canvas?.height ?? 768};
    this.onNavigate=options.onNavigate ?? (()=>{});
    this.onError=options.onError ?? (()=>{});
    this._clickHandler=event=>this._handleClick(event);
    this.canvas?.addEventListener?.("click",this._clickHandler);
  }
  setHTML(html, options = {}) {
    this.document=this.parser.parse(html,options);
    this.styles.clearStylesheets();
    for (const style of this.document.querySelectorAll("style")) this.styles.addStylesheet(style.textContent);
    this.styles.compute(this.document);
    return this.render();
  }
  addStylesheet(css) { this.styles.addStylesheet(css); if(this.document) this.styles.compute(this.document); return this.render(); }
  resize(width,height) {
    this.viewport={width:Math.max(1,width),height:Math.max(1,height)};
    if(this.canvas){this.canvas.width=this.viewport.width;this.canvas.height=this.viewport.height;}
    return this.render();
  }
  render() {
    if(!this.document) return null;
    try {
      this.styles.compute(this.document);
      const layout=this.layoutEngine.layout(this.document,this.viewport);
      return this.painter.paint(this.document,layout,this.context);
    } catch(error) { this.onError(error); throw error; }
  }
  _handleClick(event) {
    if(!this.document || !this.canvas) return;
    const rect=this.canvas.getBoundingClientRect?.() ?? {left:0,top:0,width:this.viewport.width,height:this.viewport.height};
    const x=(event.clientX-rect.left)*(this.viewport.width/(rect.width||this.viewport.width));
    const y=(event.clientY-rect.top)*(this.viewport.height/(rect.height||this.viewport.height));
    const hit=this.document.walk ? [...this.document.walk()].filter(n=>n instanceof ElementNode).reverse().find(n=>{
      const b=n.layout; return b && x>=b.x && y>=b.y && x<=b.x+b.width && y<=b.y+b.height;
    }) : null;
    if(!hit) return;
    const link=hit.tagName==="a"?hit:findAncestor(hit,"a");
    if(link?.getAttribute("href")) { event.preventDefault?.(); this.onNavigate(link.getAttribute("href"),link); }
    hit.dispatchEvent({type:"click",target:hit,clientX:x,clientY:y,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}});
  }
  destroy() { this.canvas?.removeEventListener?.("click",this._clickHandler); this.document=null; this.context=null; this.canvas=null; }
}
function findAncestor(node,tag) { for(let current=node;current;current=current.parentNode) if(current instanceof ElementNode&&current.tagName===tag)return current; return null; }
