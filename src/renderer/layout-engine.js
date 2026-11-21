import { ElementNode, TextNode } from "./document-model.js";
import { px } from "./style-engine.js";

function length(value, available, fallback=null) {
  if(value==null||value==="auto"||value==="none")return fallback;
  const text=String(value).trim();
  if(text.endsWith("%"))return available*(Number.parseFloat(text)||0)/100;
  if(text.endsWith("vw"))return available*(Number.parseFloat(text)||0)/100;
  return px(text,fallback);
}
function sides(style,prefix){return {top:px(style[prefix+"Top"]),right:px(style[prefix+"Right"]),bottom:px(style[prefix+"Bottom"]),left:px(style[prefix+"Left"])};}
function clamp(value,min,max){return Math.max(min??0,max==null?value:Math.min(value,max));}
const BLOCK=new Set(["block","flex","grid","list-item","table"]);
export class LayoutEngine {
  constructor(options={}){this.defaultLineHeight=options.lineHeight??19;this.measureText=options.measureText??(text=>String(text).length*8);}
  layout(document,viewport={}) {
    const width=Math.max(1,viewport.width??1024),height=Math.max(1,viewport.height??768),root=document.documentElement;
    const boxes=[],textRuns=[];
    if(!root)return {width,height,contentHeight:0,boxes,textRuns};
    const measure=(text,style)=>this.measureText(text,px(style.fontSize,16),style.fontFamily);
    const layoutNode=(node,x,y,availableWidth,availableHeight=height,forcedWidth=null)=>{
      if(!(node instanceof ElementNode))return {width:0,height:0};
      const s=node.computedStyle??{},display=s.display??"inline";
      if(display==="none"||s.visibility==="hidden"){node.layout={x,y,width:0,height:0};return {width:0,height:0};}
      const margin=sides(s,"margin"),padding=sides(s,"padding"),border={top:px(s.borderTopWidth),right:px(s.borderRightWidth),bottom:px(s.borderBottomWidth),left:px(s.borderLeftWidth)};
      const horizontal=padding.left+padding.right+border.left+border.right,vertical=padding.top+padding.bottom+border.top+border.bottom;
      let contentWidth=forcedWidth??length(s.width,availableWidth,null);
      if(node.tagName==="img"&&contentWidth==null)contentWidth=Number(node.getAttribute("width"))||node._intrinsicWidth||300;
      if(contentWidth!=null&&s.boxSizing==="border-box")contentWidth=Math.max(0,contentWidth-horizontal);
      contentWidth=clamp(contentWidth??Math.max(0,availableWidth-margin.left-margin.right-horizontal),length(s.minWidth,availableWidth,0),length(s.maxWidth,availableWidth,null));
      const boxX=x+margin.left,boxY=y+margin.top,contentX=boxX+border.left+padding.left,contentY=boxY+border.top+padding.top;
      const lineHeight=px(s.lineHeight,px(s.fontSize,16)*1.2||this.defaultLineHeight),isFlex=display==="flex",column=isFlex&&String(s.flexDirection??"row").startsWith("column");
      let cursorX=contentX,cursorY=contentY,lineUsed=0,flowHeight=0,maxWidth=0;
      const addText=(raw)=>{
        const value=String(raw).replace(/\s+/g," ");
        const words=value.split(/(\s+)/);
        for(const word of words){
          if(!word)continue;
          const wordWidth=measure(word,s);
          if(s.whiteSpace!=="nowrap"&&cursorX+wordWidth>contentX+contentWidth&&cursorX>contentX){
            cursorY+=Math.max(lineUsed,lineHeight);flowHeight+=Math.max(lineUsed,lineHeight);cursorX=contentX;lineUsed=0;
          }
          textRuns.push({text:word,x:cursorX,y:cursorY+px(s.fontSize,16),maxWidth:Math.max(1,contentX+contentWidth-cursorX),style:s});
          cursorX+=wordWidth;lineUsed=Math.max(lineUsed,lineHeight);
        }
      };
      const children=node.childNodes.filter(child=>!(child.nodeType===8));
      if(isFlex){
        const items=children.map(child=>{
          if(child instanceof TextNode)return {node:child,basis:measure(child.data.trim(),s),min:0,flex:0};
          const cs=child.computedStyle??{},basis=length(cs.flexBasis,contentWidth,null)??length(cs.width,contentWidth,null)??0;
          const flex=parseFloat(cs.flex??cs.flexGrow??"0")||0;
          return {node:child,basis,min:length(cs.minWidth,contentWidth,0),flex};
        });
        const gap=px(s.columnGap??s.gap),availableMain=(column?availableHeight:contentWidth)-gap*Math.max(0,items.length-1);
        const fixed=items.reduce((sum,item)=>sum+(item.flex?item.basis:item.basis),0);
        const flexTotal=items.reduce((sum,item)=>sum+item.flex,0);
        let offset=0,contentCross=0;
        for(const item of items){
          const mainSize=item.flex&&flexTotal?Math.max(item.min,item.basis+(Math.max(0,availableMain-fixed)*item.flex/flexTotal)):Math.max(item.min,item.basis||availableMain/Math.max(1,items.length));
          if(item.node instanceof TextNode){
            if(column){cursorY=contentY+offset;cursorX=contentX;addText(item.node.data);offset+=lineHeight+gap;}
            else{cursorX=contentX+offset;cursorY=contentY;const start=textRuns.length;addText(item.node.data);offset+=mainSize+gap;}
            continue;
          }
          const childWidth=column?contentWidth:mainSize;
          const childX=column?contentX:contentX+offset;
          const childY=column?contentY+offset:contentY;
          const result=layoutNode(item.node,childX,childY,childWidth,availableHeight,childWidth);
          offset+=(column?result.height:result.width)+gap;contentCross=Math.max(contentCross,column?result.width:result.height);
        }
        flowHeight=column?Math.max(0,offset-(items.length?gap:0)):contentCross;
        maxWidth=column?contentWidth:Math.max(0,offset-(items.length?gap:0));
      }else{
        for(const child of children){
          if(child instanceof TextNode){addText(child.data);continue;}
          if(!(child instanceof ElementNode))continue;
          const childDisplay=child.computedStyle?.display??"inline";
          if(BLOCK.has(childDisplay)){
            if(cursorX>contentX){const h=Math.max(lineUsed,lineHeight);cursorY+=h;flowHeight+=h;cursorX=contentX;lineUsed=0;}
            const result=layoutNode(child,contentX,cursorY,contentWidth,availableHeight);
            cursorY+=result.height;flowHeight+=result.height;maxWidth=Math.max(maxWidth,result.width);
          }else{
            const result=layoutNode(child,cursorX,cursorY,Math.max(0,contentX+contentWidth-cursorX),availableHeight);
            cursorX+=result.width;lineUsed=Math.max(lineUsed,result.height);
            if(cursorX>contentX+contentWidth){cursorX=contentX;cursorY+=lineUsed;flowHeight+=lineUsed;lineUsed=0;}
          }
        }
        if(cursorX>contentX||lineUsed){const h=Math.max(lineUsed,lineHeight);flowHeight+=h;cursorY+=h;}
      }
      let naturalHeight=Math.max(flowHeight,node.tagName==="img"?(Number(node.getAttribute("height"))||node._intrinsicHeight||150):0);
      let contentHeight=length(s.height,availableHeight,null);
      if(contentHeight!=null&&s.boxSizing==="border-box")contentHeight=Math.max(0,contentHeight-vertical);
      contentHeight=clamp(contentHeight??naturalHeight,length(s.minHeight,availableHeight,0),length(s.maxHeight,availableHeight,null));
      const totalWidth=contentWidth+horizontal,totalHeight=contentHeight+vertical;
      let finalX=boxX,finalY=boxY;
      if(s.position==="relative"){finalX+=px(s.left);finalY+=px(s.top);}
      node.layout={x:finalX,y:finalY,width:totalWidth,height:totalHeight,contentX:finalX+border.left+padding.left,contentY:finalY+border.top+padding.top,contentWidth,contentHeight,margin,padding,border};
      boxes.push(node);
      return {width:totalWidth+margin.left+margin.right,height:totalHeight+margin.top+margin.bottom};
    };
    layoutNode(root,0,0,width,height);
    const contentHeight=Math.max(height,...boxes.map(node=>node.layout.y+node.layout.height));
    document._textRuns=textRuns;
    return {width,height,contentHeight,boxes,textRuns};
  }
}
