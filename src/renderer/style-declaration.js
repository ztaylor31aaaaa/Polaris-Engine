function toKebab(name){return String(name).replace(/[A-Z]/g,c=>"-"+c.toLowerCase());}
function toCamel(name){return String(name).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());}
export function createStyleDeclaration(element){
  const values=Object.create(null);
  const read=()=>{for(const part of (element.getAttribute("style")??"").split(";")){const i=part.indexOf(":");if(i>0)values[toCamel(part.slice(0,i).trim())]=part.slice(i+1).trim();}};
  const write=()=>element.setAttribute("style",Object.entries(values).map(([k,v])=>toKebab(k)+":"+v).join("; "));
  read();
  const api={
    setProperty(name,value,priority=""){values[toCamel(name)]=String(value)+(priority?" !"+priority:"");write();},
    getPropertyValue(name){return values[toCamel(name)]??"";},
    getPropertyPriority(name){return /\s*!important$/.test(values[toCamel(name)]??"")?"important":"";},
    removeProperty(name){const key=toCamel(name),old=values[key]??"";delete values[key];write();return old;},
    get cssText(){return Object.entries(values).map(([k,v])=>toKebab(k)+":"+v).join("; ");},
    set cssText(value){for(const key of Object.keys(values))delete values[key];for(const part of String(value).split(";")){const i=part.indexOf(":");if(i>0)values[toCamel(part.slice(0,i).trim())]=part.slice(i+1).trim();}write();},
    get length(){return Object.keys(values).length;},
    item(index){return Object.keys(values)[index]??"";}
  };
  return new Proxy(api,{
    get(target,key){if(key in target)return target[key];if(typeof key==="string")return values[key]??"";return undefined;},
    set(target,key,value){if(typeof key!=="string")return false;values[key]=String(value);write();return true;},
    ownKeys(){return [...new Set([...Reflect.ownKeys(api),...Object.keys(values)])];},
    getOwnPropertyDescriptor(target,key){if(key in target)return Object.getOwnPropertyDescriptor(target,key);if(key in values)return {enumerable:true,configurable:true,value:values[key],writable:true};}
  });
}
