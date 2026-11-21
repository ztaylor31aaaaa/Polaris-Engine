import { ElementNode, TextNode } from "./document-model.js";
import { px } from "./style-engine.js";
const BLOCK = new Set(["block","flex","list-item","table"]);
function length(value, available, fallback) {
  if (value === "auto" || value == null) return fallback;
  if (String(value).endsWith("%")) return available * (Number.parseFloat(value) || 0) / 100;
  return px(value, fallback);
}
function sides(style, prefix) {
  return { top:px(style[prefix+"Top"]), right:px(style[prefix+"Right"]), bottom:px(style[prefix+"Bottom"]), left:px(style[prefix+"Left"]) };
}
export class LayoutEngine {
  constructor(options = {}) { this.defaultLineHeight = options.lineHeight ?? 19; this.measureText = options.measureText ?? (text => String(text).length * 8); }
  layout(document, viewport = {}) {
    const width = Math.max(1, viewport.width ?? 1024), height = Math.max(1, viewport.height ?? 768);
    const root = document.documentElement;
    if (!root) return {width,height,contentHeight:0,boxes:[]};
    const boxes = [];
    const layoutNode = (node, x, y, availableWidth) => {
      if (node instanceof TextNode) return {width:0,height:0};
      if (!(node instanceof ElementNode)) return {width:0,height:0};
      const s=node.computedStyle ?? {}, display=s.display ?? "inline";
      if (display === "none") { node.layout={x,y,width:0,height:0}; return {width:0,height:0}; }
      const margin=sides(s,"margin"), padding=sides(s,"padding");
      const border={top:px(s.borderTopWidth),right:px(s.borderRightWidth),bottom:px(s.borderBottomWidth),left:px(s.borderLeftWidth)};
      const outerX=x+margin.left, contentX=outerX+padding.left+border.left;
      const specified=length(s.width,availableWidth,null);
      const contentWidth=Math.max(0,Math.min(availableWidth-margin.left-margin.right-padding.left-padding.right-border.left-border.right,specified ?? availableWidth-margin.left-margin.right-padding.left-padding.right-border.left-border.right));
      const isFlex=display==="flex", children=node.childNodes;
      let cursorY=y+margin.top+padding.top+border.top, cursorX=contentX, lineHeight=0, contentHeight=0;
      const gap=px(s.gap);
      for (const child of children) {
        if (child instanceof TextNode) {
          const text=child.data.replace(/\s+/g," ");
          if (!text.trim()) continue;
          const fontSize=px(s.fontSize,16), line=px(s.lineHeight,fontSize*1.2 || this.defaultLineHeight);
          const words=text.split(/(\s+)/);
          for (const word of words) {
            if (!word) continue;
            const wordWidth=this.measureText(word,fontSize,s.fontFamily);
            if (!isFlex && cursorX+wordWidth > contentX+contentWidth && cursorX>contentX) { cursorY+=Math.max(lineHeight,line); cursorX=contentX; lineHeight=0; }
            if (isFlex) { cursorX+=wordWidth; lineHeight=Math.max(lineHeight,line); }
            else { cursorX+=wordWidth; lineHeight=Math.max(lineHeight,line); }
          }
          continue;
        }
        if (!(child instanceof ElementNode)) continue;
        if (isFlex) {
          const childBox=layoutNode(child,cursorX,cursorY,contentWidth);
          cursorX+=childBox.width+gap; lineHeight=Math.max(lineHeight,childBox.height);
        } else {
          if (child.computedStyle?.display === "inline" || child.computedStyle?.display === "inline-block") {
            const childBox=layoutNode(child,cursorX,cursorY,contentWidth); cursorX+=childBox.width;
            lineHeight=Math.max(lineHeight,childBox.height);
          } else {
            if (cursorX>contentX) { cursorY+=lineHeight; cursorX=contentX; lineHeight=0; }
            const childBox=layoutNode(child,contentX,cursorY,contentWidth);
            cursorY+=childBox.height; contentHeight+=childBox.height;
          }
        }
      }
      if (cursorX>contentX || lineHeight) cursorY+=lineHeight;
      let naturalHeight=Math.max(0,cursorY-(y+margin.top+padding.top+border.top));
      const contentH=length(s.height,height,null) ?? naturalHeight;
      const totalWidth=contentWidth+padding.left+padding.right+border.left+border.right;
      const totalHeight=contentH+padding.top+padding.bottom+border.top+border.bottom;
      node.layout={x:outerX,y:y+margin.top,width:totalWidth,height:totalHeight,contentX,contentY:y+margin.top+padding.top+border.top,contentWidth,contentHeight:contentH};
      boxes.push(node);
      return {width:totalWidth+margin.left+margin.right,height:totalHeight+margin.top+margin.bottom};
    };
    layoutNode(root,0,0,width);
    const contentHeight=Math.max(height,...boxes.map(b=>b.layout.y+b.layout.height));
    return {width,height,contentHeight,boxes};
  }
}
