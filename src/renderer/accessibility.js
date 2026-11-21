import { ElementNode,TextNode } from "./document-model.js";
const ROLES={a:"link",button:"button",input:"textbox",textarea:"textbox",select:"combobox",img:"img",nav:"navigation",main:"main",header:"banner",footer:"contentinfo",form:"form",h1:"heading",h2:"heading",h3:"heading",h4:"heading",ul:"list",ol:"list",li:"listitem"};
export function buildAccessibilityTree(document){
  const visit=node=>{
    if(node instanceof TextNode){const text=node.data.trim();return text?{role:"text",name:text}:null;}
    if(!(node instanceof ElementNode))return null;
    const style=node.computedStyle??{};if(style.display==="none"||style.visibility==="hidden"||node.hasAttribute("aria-hidden")&&node.getAttribute("aria-hidden")==="true")return null;
    const role=node.getAttribute("role")??ROLES[node.tagName]??"generic";
    const label=node.getAttribute("aria-label")??node.getAttribute("alt")??node.getAttribute("title")??(node.tagName==="input"?node.getAttribute("placeholder"):null)??"";
    const children=node.childNodes.map(visit).filter(Boolean);
    const name=label||children.map(child=>child.name).filter(Boolean).join(" ");
    return {role,name,tagName:node.tagName,id:node.id||null,disabled:node.hasAttribute("disabled"),checked:node.checked??false,children};
  };
  const root=document.body??document.documentElement;
  return root?root.childNodes.map(visit).filter(Boolean):[];
}
