import { ElementNode } from "./document-model.js";
import { px } from "./style-engine.js";
function parseRadius(value,width,height){if(!value||value==="0"||value==="0px")return 0;const first=String(value).trim().split(/\s+/)[0],number=parseFloat(first);if(!Number.isFinite(number))return 0;return first.endsWith("%")?Math.min(width,height)*number/100:number;}
export class PaintEngine {
  constructor(options={}){this.background=options.background??"#ffffff";this.lastFrame=null;this.images=options.images??new Map();}
  paint(document,layout,context,viewport={}) {
    if(!context)throw new TypeError("A CanvasRenderingContext2D is required");
    const canvas=context.canvas,dpr=Math.max(1,Number(viewport.devicePixelRatio??1));context.save();context.setTransform?.(dpr,0,0,dpr,0,0);context.clearRect(0,0,layout.width,layout.height);
    context.fillStyle=this.background;context.fillRect(0,0,layout.width,layout.height);
    context.save();context.beginPath();context.rect(0,0,layout.width,layout.height);context.clip();context.translate(-(viewport.scrollX??0),-(viewport.scrollY??0));
    for(const node of layout.boxes??[]){
      const b=node.layout??{},s=node.computedStyle??{};
      if(s.display==="none"||s.visibility==="hidden")continue;
      context.save();context.globalAlpha=Math.max(0,Math.min(1,Number(s.opacity??1)));
      const radius=parseRadius(s.borderRadius,b.width,b.height);
      if(s.backgroundColor&&s.backgroundColor!=="transparent"){
        context.fillStyle=s.backgroundColor;
        if(radius&&context.roundRect){context.beginPath();context.roundRect(b.x,b.y,b.width,b.height,radius);context.fill();}
        else context.fillRect(b.x,b.y,b.width,b.height);
      }
      const borderWidths=["Top","Right","Bottom","Left"].map(side=>px(s["border"+side+"Width"]));
      const borderStyles=["Top","Right","Bottom","Left"].map(side=>s["border"+side+"Style"]??"none");
      const borderColors=["Top","Right","Bottom","Left"].map(side=>s["border"+side+"Color"]??"#000");
      const uniformBorder=borderWidths.every(value=>value===borderWidths[0])&&borderStyles.every(value=>value===borderStyles[0])&&borderColors.every(value=>value===borderColors[0]);
      if(uniformBorder&&borderWidths[0]>0&&borderStyles[0]!=="none"&&context.roundRect){
        context.beginPath();context.roundRect(b.x+borderWidths[0]/2,b.y+borderWidths[0]/2,Math.max(0,b.width-borderWidths[0]),Math.max(0,b.height-borderWidths[0]),radius);context.strokeStyle=borderColors[0];context.lineWidth=borderWidths[0];context.stroke();
      }else for(const side of ["Top","Right","Bottom","Left"]){
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
      context.textBaseline="alphabetic";context.textAlign="left";if("letterSpacing" in context)context.letterSpacing=s.letterSpacing??"0px";
      context.fillText(run.text,run.x,run.y,run.maxWidth??layout.width);context.restore();
    }
    context.restore();context.restore();
    this.lastFrame={width:layout.width,height:layout.height,contentHeight:layout.contentHeight,paintedAt:Date.now()};
    return this.lastFrame;
  }
}
