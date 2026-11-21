import { ElementNode, TextNode } from "./document-model.js";
import { px } from "./style-engine.js";
export class PaintEngine {
  constructor(options = {}) { this.background = options.background ?? "#ffffff"; this.lastFrame = null; }
  paint(document, layout, context) {
    if (!context) throw new TypeError("A CanvasRenderingContext2D is required");
    const canvas=context.canvas;
    context.clearRect(0,0,canvas?.width ?? layout.width,canvas?.height ?? layout.height);
    context.fillStyle=this.background; context.fillRect(0,0,layout.width,layout.height);
    const drawNode = node => {
      if (!(node instanceof ElementNode)) return;
      const b=node.layout ?? {}, s=node.computedStyle ?? {};
      if (s.display === "none" || s.visibility === "hidden") return;
      context.save();
      context.globalAlpha=Math.max(0,Math.min(1,Number(s.opacity ?? 1)));
      if (s.backgroundColor && s.backgroundColor !== "transparent") {
        context.fillStyle=s.backgroundColor; context.fillRect(b.x,b.y,b.width,b.height);
      }
      const bw=px(s.borderTopWidth);
      if (bw && s.borderTopStyle !== "none") {
        context.strokeStyle=s.borderTopColor ?? "#000"; context.lineWidth=bw;
        context.strokeRect(b.x+bw/2,b.y+bw/2,Math.max(0,b.width-bw),Math.max(0,b.height-bw));
      }
      context.restore();
      let textY=(b.contentY ?? b.y)+px(s.fontSize,16);
      for (const child of node.childNodes) {
        if (child instanceof TextNode) {
          const text=child.data.replace(/\s+/g," ").trim();
          if (text) {
            context.save(); context.fillStyle=s.color ?? "#000";
            context.font=`${s.fontStyle ?? "normal"} ${s.fontWeight ?? "400"} ${s.fontSize ?? "16px"} ${s.fontFamily ?? "Arial"}`;
            context.textBaseline="alphabetic";
            context.fillText(text,(b.contentX ?? b.x),textY,Math.max(1,b.contentWidth ?? b.width));
            textY+=px(s.lineHeight,px(s.fontSize,16)*1.2);
            context.restore();
          }
        } else drawNode(child);
      }
    };
    for (const child of document.childNodes) if (child instanceof ElementNode) drawNode(child);
    this.lastFrame={width:layout.width,height:layout.height,contentHeight:layout.contentHeight};
    return this.lastFrame;
  }
}
