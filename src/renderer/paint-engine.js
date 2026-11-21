import { ElementNode,TextNode } from "./document-model.js";
import { px } from "./style-engine.js";
export class PaintEngine {
  constructor(options={}){this.background=options.background??"#ffffff";this.lastFrame=null;this.images=options.images??new Map();}
  paint(document,layout,context){
    if(!context)throw new TypeError("A CanvasRenderingContext2D is required");
    const canvas=context.canvas;context.clearRect(0,0,canvas?.width??layout.width,canvas?.height??layout.height);
    context.fillStyle=this.background;context.fillRect(0,0,layout.width,layout.height);
    const drawNode=node=>{
      if(!(node instanceof ElementNode))return;
      const b=node.layout??{},s=node.computedStyle??{};
      if(s.display==="none"||s.visibility==="hidden")return;
      context.save();context.globalAlpha=Math.max(0,Math.min(1,Number(s.opacity??1)));
      if(s.backgroundColor&&s.backgroundColor!=="transparent"){context.fillStyle=s.backgroundColor;context.fillRect(b.x,b.y,b.width,b.height);}
      const sides=["Top","Right","Bottom","Left"];
      for(const side of sides){const width=px(s["border"+side+"Width"]);if(!width||s["border"+side+"Style"]==="none")continue;context.fillStyle=s["border"+side+"Color"]??"#000";if(side==="Top")context.fillRect(b.x,b.y,b.width,width);else if(side==="Bottom")context.fillRect(b.x,b.y+b.height-width,b.width,width);else if(side==="Left")context.fillRect(b.x,b.y,width,b.height);else context.fillRect(b.x+b.width-width,b.y,width,b.height);}
      const radius=px(s.borderRadius);if(radius&&s.backgroundColor&&s.backgroundColor!=="transparent"){context.beginPath();context.roundRect?.(b.x,b.y,b.width,b.height,radius);}
      context.restore();
      if(node.tagName==="img"){
        const image=this.images.get(node);
        if(image){const w=lengthAttr(node,"width",image.width),h=lengthAttr(node,"height",image.height);context.drawImage(image.bitmap??image,b.contentX??b.x,b.contentY??b.y,w,h);}
      }
      const fontSize=px(s.fontSize,16),lineHeight=px(s.lineHeight,fontSize*1.2),textX=b.contentX??b.x;
      let textY=(b.contentY??b.y)+fontSize;
      for(const child of node.childNodes){
        if(child instanceof TextNode){
          const text=child.data.replace(/\s+/g," ").trim();if(!text)continue;
          context.save();context.fillStyle=s.color??"#000";context.font=`${s.fontStyle??"normal"} ${s.fontWeight??"400"} ${s.fontSize??"16px"} ${s.fontFamily??"Arial"}`;
          context.textBaseline="alphabetic";context.textAlign=s.textAlign==="center"?"center":s.textAlign==="right"?"right":"left";
          const drawX=s.textAlign==="center"?textX+(b.contentWidth??b.width)/2:s.textAlign==="right"?textX+(b.contentWidth??b.width):textX;
          const maxWidth=Math.max(1,b.contentWidth??b.width);const words=text.split(/(\s+)/);let line="",y=textY;
          for(const word of words){const candidate=line+word;if(line&&context.measureText(candidate).width>maxWidth){context.fillText(line,drawX,y,maxWidth);line=word;y+=lineHeight;}else line=candidate;}
          if(line)context.fillText(line,drawX,y,maxWidth);textY=y+lineHeight;context.restore();
        }else drawNode(child);
      }
    };
    for(const child of document.childNodes)if(child instanceof ElementNode)drawNode(child);
    this.lastFrame={width:layout.width,height:layout.height,contentHeight:layout.contentHeight,paintedAt:Date.now()};return this.lastFrame;
  }
}
function lengthAttr(node,name,fallback){const value=node.getAttribute(name);return value&&Number.isFinite(Number(value))?Number(value):fallback;}
