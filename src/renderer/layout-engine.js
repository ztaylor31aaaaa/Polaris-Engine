import { ElementNode, TextNode } from "./document-model.js";
import { px } from "./style-engine.js";
const BLOCK = new Set(["block","flex","list-item","table","grid"]);
function length(value, available, fallback=null) {
  if(value==="auto"||value==null)return fallback;
  if(String(value).endsWith("%"))return available*(Number.parseFloat(value)||0)/100;
  if(String(value).endsWith("em"))return px(value)*16;
  if(String(value).endsWith("rem"))return px(value)*16;
  return px(value,fallback);
}
function sides(style,prefix){return {top:px(style[prefix+"Top"]),right:px(style[prefix+"Right"]),bottom:px(style[prefix+"Bottom"]),left:px(style[prefix+"Left"])};}
function clamp(value,min,max){return Math.max(min??0,max==null?value:Math.min(value,max));}
export class LayoutEngine {
  constructor(options={}){this.defaultLineHeight=options.lineHeight??19;this.measureText=options.measureText??(text=>String(text).length*8);}
  layout(document,viewport={}){
    const width=Math.max(1,viewport.width??1024),height=Math.max(1,viewport.height??768),root=document.documentElement;
    if(!root)return {width,height,contentHeight:0,boxes:[]};
    const boxes=[],measure=(text,style)=>this.measureText(text,px(style.fontSize,16),style.fontFamily);
    const layoutNode=(node,x,y,availableWidth,availableHeight=height)=>{
      if(node instanceof TextNode)return {width:0,height:0};
      if(!(node instanceof ElementNode))return {width:0,height:0};
      const s=node.computedStyle??{},display=s.display??"inline";
      if(display==="none"){node.layout={x,y,width:0,height:0};return {width:0,height:0};}
      const margin=sides(s,"margin"),padding=sides(s,"padding"),border={top:px(s.borderTopWidth),right:px(s.borderRightWidth),bottom:px(s.borderBottomWidth),left:px(s.borderLeftWidth)};
      const boxSizing=s.boxSizing??"content-box";
      const horizontal=padding.left+padding.right+border.left+border.right,vertical=padding.top+padding.bottom+border.top+border.bottom;
      let contentWidth=length(s.width,availableWidth,null);
      if(contentWidth!=null&&boxSizing==="border-box")contentWidth=Math.max(0,contentWidth-horizontal);
      contentWidth=clamp(contentWidth??Math.max(0,availableWidth-margin.left-margin.right-horizontal),length(s.minWidth,availableWidth,0),length(s.maxWidth,availableWidth,null));
      const contentX=x+margin.left+border.left+padding.left,contentY=y+margin.top+border.top+padding.top;
      const isFlex=display==="flex",column=isFlex&&s.flexDirection?.startsWith("column"),children=node.childNodes;
      let cursorY=contentY,cursorX=contentX,lineHeight=0,usedHeight=0,maxChildWidth=0;
      const gap=px(s.gap),line=px(s.lineHeight,px(s.fontSize,16)*1.2||this.defaultLineHeight);
      const inlineText=(text)=>{
        const normalized=s.whiteSpace==="pre"?text:text.replace(/\s+/g," ");
        for(const word of normalized.split(/(\s+)/)){
          if(!word)continue;
          const wordWidth=measure(word,s);
          if(s.whiteSpace!=="nowrap"&&cursorX+wordWidth>contentX+contentWidth&&cursorX>contentX){cursorY+=Math.max(lineHeight,line);usedHeight+=Math.max(lineHeight,line);cursorX=contentX;lineHeight=0;}
          cursorX+=wordWidth;lineHeight=Math.max(lineHeight,line);
        }
      };
      const flexItems=[];
      for(const child of children){
        if(child instanceof TextNode){if(isFlex){if(child.data.trim())flexItems.push({node:child,text:child.data,width:measure(child.data,s),height:line});}else inlineText(child.data);continue;}
        if(!(child instanceof ElementNode))continue;
        const childDisplay=child.computedStyle?.display??"inline";
        if(isFlex){
          const childBox=layoutNode(child,0,0,column?contentWidth:contentWidth,availableHeight);
          flexItems.push({node:child,width:childBox.width,height:childBox.height});
        }else if(childDisplay==="inline"||childDisplay==="inline-block"){
          const childBox=layoutNode(child,cursorX,cursorY,Math.max(0,contentX+contentWidth-cursorX),availableHeight);
          cursorX+=childBox.width;lineHeight=Math.max(lineHeight,childBox.height);
          if(childDisplay==="inline-block")maxChildWidth=Math.max(maxChildWidth,cursorX-contentX);
        }else{
          if(cursorX>contentX){cursorY+=lineHeight;usedHeight+=lineHeight;cursorX=contentX;lineHeight=0;}
          const childBox=layoutNode(child,contentX,cursorY,contentWidth,availableHeight);
          cursorY+=childBox.height;usedHeight+=childBox.height;maxChildWidth=Math.max(maxChildWidth,childBox.width);
        }
      }
      if(isFlex){
        const totalMain=flexItems.reduce((sum,item)=>sum+(column?item.height:item.width),0)+Math.max(0,flexItems.length-1)*gap;
        const free=Math.max(0,(column?availableHeight:contentWidth)-totalMain);
        let offset=0,between=gap;
        if(s.justifyContent==="center")offset=free/2;
        else if(s.justifyContent==="flex-end")offset=free;
        else if(s.justifyContent==="space-between"&&flexItems.length>1)between=gap+free/(flexItems.length-1);
        else if(s.justifyContent==="space-around"&&flexItems.length){between=gap+free/flexItems.length;offset=free/(2*flexItems.length);}
        for(const item of flexItems){
          if(item.node instanceof TextNode){if(column){cursorY=contentY+offset;offset+=item.height+between;}else{cursorX=contentX+offset;offset+=item.width+between;}continue;}
          if(column){const childX=s.alignItems==="center"?contentX+(contentWidth-item.width)/2:s.alignItems==="flex-end"?contentX+contentWidth-item.width:contentX;const box=layoutNode(item.node,childX,contentY+offset,contentWidth,availableHeight);offset+=box.height+between;}
          else{const childY=s.alignItems==="center"?contentY+(line-item.height)/2:s.alignItems==="flex-end"?contentY+line-item.height:contentY;const box=layoutNode(item.node,contentX+offset,childY,item.width,availableHeight);offset+=box.width+between;usedHeight=Math.max(usedHeight,box.height);}
        }
        if(column)usedHeight=Math.max(0,offset-between);else usedHeight=Math.max(usedHeight,...flexItems.map(i=>i.height));
      }else if(cursorX>contentX||lineHeight){cursorY+=lineHeight;usedHeight+=lineHeight;}
      let naturalHeight=Math.max(usedHeight,cursorY-contentY);
      if(s.display==="list-item")naturalHeight=Math.max(naturalHeight,line);
      let contentHeight=length(s.height,availableHeight,null);
      if(contentHeight!=null&&boxSizing==="border-box")contentHeight=Math.max(0,contentHeight-vertical);
      contentHeight=clamp(contentHeight??naturalHeight,length(s.minHeight,availableHeight,0),length(s.maxHeight,availableHeight,null));
      const totalWidth=contentWidth+horizontal,totalHeight=contentHeight+vertical;
      let finalX=x+margin.left,finalY=y+margin.top;
      if(s.position==="relative"){finalX+=px(s.left);finalY+=px(s.top);}
      node.layout={x:finalX,y:finalY,width:totalWidth,height:totalHeight,contentX:finalX+border.left+padding.left,contentY:finalY+border.top+padding.top,contentWidth,contentHeight,margin,padding,border};
      boxes.push(node);
      return {width:totalWidth+margin.left+margin.right,height:totalHeight+margin.top+margin.bottom};
    };
    layoutNode(root,0,0,width,height);
    const contentHeight=Math.max(height,...boxes.map(node=>node.layout.y+node.layout.height));
    return {width,height,contentHeight,boxes};
  }
}
