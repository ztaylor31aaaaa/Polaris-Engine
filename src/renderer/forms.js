import { ElementNode } from "./document-model.js";
export function collectFormData(form){
  if(!(form instanceof ElementNode)||form.tagName!=="form")throw new TypeError("Expected a form element");
  const entries=[];
  for(const control of form.querySelectorAll("input,select,textarea,button")){
    const name=control.getAttribute("name");if(!name||control.hasAttribute("disabled"))continue;
    const type=(control.getAttribute("type")??"").toLowerCase();
    if((type==="checkbox"||type==="radio")&&!control.checked)continue;
    if(type==="submit"||type==="button"||type==="reset"||type==="file")continue;
    entries.push([name,control.value??control.getAttribute("value")??""]);
  }
  return entries;
}
export function encodeFormData(form,method="GET"){
  const entries=collectFormData(form),params=new URLSearchParams(entries),normalized=String(method).toUpperCase();
  if(normalized==="GET"){const action=form.getAttribute("action")??"";let base=form.ownerDocument?.url??"https://polaris.invalid/";try{const parsed=new URL(base);if(!["http:","https:"].includes(parsed.protocol))base="https://polaris.invalid/";}catch{base="https://polaris.invalid/";}const url=new URL(action,base);for(const [k,v] of params)url.searchParams.append(k,v);return {method:"GET",url:url.href,body:null,contentType:null};}
  return {method:normalized,url:form.getAttribute("action")??"",body:params.toString(),contentType:"application/x-www-form-urlencoded;charset=UTF-8"};
}
