import { parseCSS, parseDeclarations, selectorSpecificity, mediaMatches } from "./css-parser.js";
import { matchesSelector, ElementNode } from "./document-model.js";

const INITIAL = {
  display:"inline", position:"static", boxSizing:"content-box", color:"#000000",
  backgroundColor:"transparent", fontFamily:"Arial, sans-serif", fontSize:"16px",
  fontWeight:"400", fontStyle:"normal", lineHeight:"normal", textAlign:"start",
  whiteSpace:"normal", visibility:"visible", opacity:"1", overflow:"visible",
  width:"auto", height:"auto", minWidth:"0", minHeight:"0", maxWidth:"none", maxHeight:"none",
  marginTop:"0", marginRight:"0", marginBottom:"0", marginLeft:"0",
  paddingTop:"0", paddingRight:"0", paddingBottom:"0", paddingLeft:"0",
  borderTopWidth:"0", borderRightWidth:"0", borderBottomWidth:"0", borderLeftWidth:"0",
  borderTopColor:"#000", borderRightColor:"#000", borderBottomColor:"#000", borderLeftColor:"#000",
  borderTopStyle:"none", borderRightStyle:"none", borderBottomStyle:"none", borderLeftStyle:"none",
  flexDirection:"row", flexWrap:"nowrap", justifyContent:"flex-start", alignItems:"stretch", gap:"0"
};
const INHERITED = new Set(["color","fontFamily","fontSize","fontWeight","fontStyle","lineHeight","textAlign","whiteSpace","visibility"]);
const BLOCK = new Set(["html","body","div","main","section","article","header","footer","nav","aside","p","h1","h2","h3","h4","h5","h6","ul","ol","li","form","pre","blockquote","table","tr"]);
const UA = {
  body:{marginTop:"8px",marginRight:"8px",marginBottom:"8px",marginLeft:"8px"},
  p:{marginTop:"16px",marginBottom:"16px"},
  h1:{fontSize:"32px",fontWeight:"700",marginTop:"21px",marginBottom:"21px"},
  h2:{fontSize:"24px",fontWeight:"700",marginTop:"20px",marginBottom:"20px"},
  h3:{fontSize:"19px",fontWeight:"700",marginTop:"16px",marginBottom:"16px"},
  h4:{fontSize:"16px",fontWeight:"700"},
  h5:{fontSize:"13px",fontWeight:"700"},
  h6:{fontSize:"11px",fontWeight:"700"},
  strong:{fontWeight:"700"},b:{fontWeight:"700"},em:{fontStyle:"italic"},i:{fontStyle:"italic"},
  small:{fontSize:"13px"},sub:{fontSize:"12px"},sup:{fontSize:"12px"},
  pre:{whiteSpace:"pre",fontFamily:"monospace"},code:{fontFamily:"monospace"},
  button:{fontFamily:"Arial, sans-serif",fontSize:"13px",padding:"2px 6px"},
  input:{fontFamily:"Arial, sans-serif",fontSize:"13px",padding:"2px"},
  ul:{paddingLeft:"40px"},ol:{paddingLeft:"40px"},li:{display:"list-item"}
};
function px(value, fallback = 0) { const m = String(value ?? "").trim().match(/^(-?(?:\d+\.?\d*|\.\d+))(px|em|rem)?$/); return m ? Number(m[1]) * (m[2]==="em"||m[2]==="rem"?16:1) : fallback; }
function expandBox(style, base, candidates) {
  const value = style[base] ?? "0", parts = value.split(/\s+/).map(v => v.trim()).filter(Boolean);
  const [a,b=a,c=a,d=b] = parts;
  for (const [side,v] of [["Top",a],["Right",b],["Bottom",c],["Left",d]]) if (style[base] && !candidates.has(base+side)) style[base+side] = v;
}
export class StyleEngine {
  constructor() { this.rules = []; this.viewport = { width:1024, height:768, colorScheme:"light" }; }
  setViewport(viewport = {}) { this.viewport = { ...this.viewport, ...viewport }; return this; }
  addStylesheet(css) { this.rules.push(...parseCSS(css)); return this.rules.length; }
  clearStylesheets() { this.rules = []; }
  compute(document) {
    for (const node of document.walk()) {
      if (!(node instanceof ElementNode)) continue;
      const style = { ...INITIAL, ...(UA[node.tagName] ?? {}) };
      const parent = node.parentNode instanceof ElementNode ? node.parentNode.computedStyle : null;
      if (parent) for (const key of INHERITED) style[key] = parent[key];
      const candidates = new Map();
      const apply = (property, value, important, specificity, order) => {
        const previous = candidates.get(property);
        const rank = [important ? 1 : 0, specificity, order];
        if (!previous || rank[0] > previous.rank[0] || (rank[0] === previous.rank[0] && (rank[1] > previous.rank[1] || (rank[1] === previous.rank[1] && rank[2] >= previous.rank[2])))) candidates.set(property,{value,rank});
      };
      for (const rule of this.rules) {
        try {
          const selector = rule.selector.trim();
          const simpleMatch = selector.startsWith(".") && !selector.includes(" ") ? node.classList.contains(selector.slice(1)) :
            selector.startsWith("#") && !selector.includes(" ") ? node.id === selector.slice(1) :
            /^[a-z][\\w-]*$/i.test(selector) ? node.tagName === selector.toLowerCase() : matchesSelector(node, selector);
          if (simpleMatch) for (const d of rule.declarations) apply(d.property,d.value,d.important,selectorSpecificity(rule.selector),rule.order);
        } catch {}
      }
      const inline = node.getAttribute("style");
      if (inline) {
        let order = 100000;
        for (const d of parseDeclarations(inline)) apply(d.property,d.value,d.important,1000,order++);
      }
      for (const [property, item] of candidates) style[property] = item.value;
      expandBorders(style,candidates);
      if (node.hasAttribute("hidden")) style.display = "none";
      if (node.hasAttribute("style")) Object.assign(node.style, Object.fromEntries(parseDeclarations(inline).map(d=>[d.property,d.value])));
      if (style.display === "inline" && BLOCK.has(node.tagName)) style.display = "block";
      if (node.tagName === "img" || node.tagName === "input" || node.tagName === "button") if (style.display === "inline") style.display = "inline-block";
      expandBox(style,"margin",candidates); expandBox(style,"padding",candidates);
      node.computedStyle = style;
    }
    return document;
  }
}
function expandBorders(style,candidates) {
  const expand=(key, sides)=>{
    const value=style[key];if(!value)return;
    const parts=value.split(/\s+/);
    const width=parts.find(v=>/^-?[\d.]+(?:px|em|rem)$/.test(v))??"1px";
    const lineStyle=parts.find(v=>["none","solid","dashed","dotted","double"].includes(v))??"solid";
    const color=parts.find(v=>v!==width&&v!==lineStyle)??"#000";
    for(const side of sides){
      if(!candidates.has(side+"Width"))style[side+"Width"]=width;
      if(!candidates.has(side+"Style"))style[side+"Style"]=lineStyle;
      if(!candidates.has(side+"Color"))style[side+"Color"]=color;
    }
  };
  expand("border",["borderTop","borderRight","borderBottom","borderLeft"]);
  for(const side of ["Top","Right","Bottom","Left"])expand("border"+side,["border"+side]);
}
function awaitlessDeclarations(source) {
  return String(source).split(";").map(part => {
    const i=part.indexOf(":"); return i>0 ? {property:part.slice(0,i).trim().replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()),value:part.slice(i+1).trim(),important:false} : null;
  }).filter(d=>d?.property && d.value);
}
export { px };
