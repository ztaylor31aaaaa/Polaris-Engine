import { PolarisScriptBridge } from "./script-bridge.js";
import { ElementNode, TextNode } from "./document-model.js";

/** Expanded, allowlisted DOM bridge for separately isolated page JavaScript. */
export class PolarisDOMBridge extends PolarisScriptBridge {
  constructor(options={}) {
    super(options);
    const add=(name,fn)=>{this.allowedMethods.add(name);this.handlers.set(name,fn);};
    const node=id=>this._resolveNode(id);
    const el=id=>{const n=node(id);if(!(n instanceof ElementNode))throw new TypeError("Element required");return n;};
    add("createTextNode",a=>this._rememberNode(new TextNode(a.text??"")));
    add("appendChild",a=>{const p=node(a.parentId),c=node(a.childId);p.appendChild(c);return c.nodeId;});
    add("removeChild",a=>{const p=node(a.parentId),c=node(a.childId);p.removeChild(c);return c.nodeId;});
    add("getTextContent",a=>node(a.nodeId).textContent);
    add("setTextContent",a=>{node(a.nodeId).textContent=String(a.value??"");return true;});
    add("getElementById",a=>this.runtime.document.getElementById(a.id)?.nodeId??null);
    add("hasAttribute",a=>el(a.nodeId).hasAttribute(a.name));
    add("getProperty",a=>{if(!PROPERTIES.has(a.name))throw new Error("Property is not exposed");return el(a.nodeId)[a.name]??null;});
    add("setProperty",a=>{if(!PROPERTIES.has(a.name))throw new Error("Property is not exposed");el(a.nodeId)[a.name]=a.value;return true;});
    add("insertBefore",a=>{const p=node(a.parentId),c=node(a.childId),r=a.referenceId==null?null:node(a.referenceId);p.insertBefore(c,r);return c.nodeId;});
    add("removeNode",a=>{node(a.nodeId).parentNode?.removeChild(node(a.nodeId));return true;});
    add("getInnerHTML",a=>el(a.nodeId).innerHTML);
    add("setInnerHTML",a=>{el(a.nodeId).innerHTML=String(a.value??"");this.runtime.decorateTree();return true;});
    add("insertAdjacentHTML",a=>{el(a.nodeId).insertAdjacentHTML(a.position,a.html);return true;});
    add("getStyle",a=>el(a.nodeId).style.getPropertyValue(a.property));
    add("getParent",a=>node(a.nodeId).parentNode?.nodeId??null);
    add("getChildren",a=>[...(node(a.nodeId).childNodes??[])].map(n=>n.nodeId));
    add("getNodeInfo",a=>{const n=node(a.nodeId);return {nodeId:n.nodeId,nodeType:n.nodeType,nodeName:n.nodeName,tagName:n.tagName??null};});
    add("contains",a=>node(a.nodeId).contains(node(a.otherId)));
    add("matches",a=>el(a.nodeId).matches(a.selector));
    add("closest",a=>el(a.nodeId).closest(a.selector)?.nodeId??null);
    add("getBoundingClientRect",a=>{const r=el(a.nodeId).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,top:r.top,right:r.right,bottom:r.bottom,left:r.left};});
    add("focus",a=>{this.runtime.focus(el(a.nodeId));return true;});
    add("blur",a=>{this.runtime.blur(el(a.nodeId));return true;});
  }
  _rememberNode(n){this.createdNodes.set(n.nodeId,n);return n.nodeId;}
  _resolveNode(id){
    const n=this.createdNodes.get(id);if(n)return n;
    if(this.runtime.document.nodeId===id)return this.runtime.document;
    for(const item of this.runtime.document.walk())if(item.nodeId===id)return item;
    throw new Error("Unknown document node");
  }
}
const PROPERTIES=new Set(["id","className","textContent","innerText","innerHTML","value","checked","disabled","href","src","name","type","title","placeholder","alt","tabIndex"]);
