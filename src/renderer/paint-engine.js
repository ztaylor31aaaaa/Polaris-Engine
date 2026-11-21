import { ElementNode } from "./document-model.js";
import { px } from "./style-engine.js";
export class PaintEngine {
  constructor(options={}){this.background=options.background??"#ffffff";this.lastFrame=null;this.images=options.images??new Map();}
  paint(document,layout,context,viewport={}) {
    if(!context)throw new TypeError("A CanvasRenderingContext2D is required");
    const canvas=context.canvas;context.clearRect(0,0,canvas?.width??layout.width,canvas?.height??layout.height);
    context.fillStyle=this.background;context.fillRect(0,0,layout.width,layout.height);
    context.save();context.beginPath();context.rect(0,0,layout.width,layout.height);context.clip();context.translate(-(viewport.scrollX??0),-(viewport.scrollY??0));
    for(const node of layout.boxes??[]){
      const b=node.layout??{},s=node.computedStyle??{};
      if(s.display==="none"||s.visibility==="hidden")continue;
      context.save();context.globalAlpha=Math.max(0,Math.min(1,Number(s.opacity??1)));
      if(s.backgroundColor&&s.backgroundColor!=="transparent"){context.fillStyle=s.backgroundColor;context.fillRect(b.x,b.y,b.width,b.height);}
      for(const side of ["Top","Right","Bottom","Left"]){
        const width=px(s["border"+side+"Width"]);if(!width||s["border"+side+"Style"]==="none")continue;
        context.fillStyle=s["border"+side+"Color"]??"#000";
        if(side==="Top")context.fillRect(b.x,b.y,b.width,width);
        else if(side==="Bottom")context.fillRect(b.x,b.y+b.height-width,b.width,width);
        else if(side==="Left")context.fillRect(b.x,b.y,width,b.height);
        else context.fillRect(b.x+b.width-width,b.y,width,b.height);
      }
      if(node.tagName==="img"){
        const image=this.images.get(node);
        if(image){const w=b.contentWidth??image.width,h=b.contentHeight??image.height;context.drawImage(image.bitmap??image,b.contentX??b.x,b.contentY??b.y,w,h);}
      }
      context.restore();
    }
    for(const run of layout.textRuns??document._textRuns??[]){
      const s=run.style??{};context.save();context.fillStyle=s.color??"#000";
      context.font=`${s.fontStyle??"normal"} ${s.fontWeight??"400"} ${s.fontSize??"16px"} ${s.fontFamily??"Arial"}`;
      context.textBaseline="alphabetic";context.textAlign="left";
      context.fillText(run.text,run.x,run.y,run.maxWidth??layout.width);context.restore();
    }
    context.restore();
    this.lastFrame={width:layout.width,height:layout.height,contentHeight:layout.contentHeight,paintedAt:Date.now()};
    return this.lastFrame;
  }
}
