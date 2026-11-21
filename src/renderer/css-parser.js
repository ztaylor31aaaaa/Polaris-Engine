function stripComments(css){return String(css).replace(/\/\*[\s\S]*?\*\//g,"");}
function splitTopLevel(source,delimiter){
  const parts=[];let start=0,depth=0,quote="";
  for(let i=0;i<source.length;i++){const c=source[i];if(quote){if(c===quote&&source[i-1]!=="\\")quote="";continue;}if(c==="'"||c==='"'){quote=c;continue;}if(c==="("||c==="[")depth++;else if(c===")"||c==="]")depth--;else if(c===delimiter&&depth===0){parts.push(source.slice(start,i));start=i+1;}}
  parts.push(source.slice(start));return parts;
}
export function parseDeclarations(source){
  const declarations=[];
  for(const part of splitTopLevel(String(source),";")){
    const colon=part.indexOf(":");if(colon<1)continue;
    const property=part.slice(0,colon).trim().replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());
    let value=part.slice(colon+1).trim(),important=false;
    if(!property||!value)continue;
    if(/\s*!important\s*$/i.test(value)){value=value.replace(/\s*!important\s*$/i,"").trim();important=true;}
    declarations.push({property,value,important});
  }
  return declarations;
}
function findMatchingBrace(source,open){
  let depth=1,quote="";
  for(let i=open+1;i<source.length;i++){const c=source[i];if(quote){if(c===quote&&source[i-1]!=="\\")quote="";continue;}if(c==="'"||c==='"'){quote=c;continue;}if(c==="{")depth++;else if(c==="}"&&--depth===0)return i;}
  return -1;
}
function mediaMatches(condition,context={}){
  if(!condition)return true;
  const width=context.width??1024,height=context.height??768,scheme=context.colorScheme??"light";
  for(const query of condition.split(/\s*,\s*/)){
    const q=query.toLowerCase();let valid=true;
    for(const [,bound,dimension,amount] of q.matchAll(/\((min|max)-(width|height)\s*:\s*([\d.]+)px\)/g)){
      const actual=dimension==="width"?width:height,expected=Number(amount);
      if(bound==="min"&&actual<expected)valid=false;
      if(bound==="max"&&actual>expected)valid=false;
    }
    const orientation=q.match(/\(orientation\s*:\s*(portrait|landscape)\)/);if(orientation&&((orientation[1]==="portrait")!==(height>=width)))valid=false;
    const color=q.match(/\(prefers-color-scheme\s*:\s*(dark|light)\)/);if(color&&color[1]!==scheme)valid=false;
    if(valid)return true;
  }
  return false;
}
export function parseCSS(css,context={}){
  const source=stripComments(css),rules=[];
  const parseBlock=(text,media="")=>{
    let i=0;
    while(i<text.length){
      while(i<text.length&&/\s/.test(text[i]))i++;
      const open=text.indexOf("{",i);if(open<0)break;
      const close=findMatchingBrace(text,open);if(close<0)break;
      const selector=text.slice(i,open).trim(),body=text.slice(open+1,close);
      if(selector.startsWith("@media")){
        const condition=selector.slice(6).trim(),combined=media?media+" and "+condition:condition;
        parseBlock(body,combined);
      }else if(selector.startsWith("@")){/* Unsupported grouping and declaration at-rules are ignored. */}
      else if(selector){
        for(const item of splitTopLevel(selector,",")){const trimmed=item.trim();if(trimmed)rules.push({selector:trimmed,declarations:parseDeclarations(body),order:rules.length,media:media||null});}
      }
      i=close+1;
    }
  };
  parseBlock(source);return rules;
}
export function selectorSpecificity(selector){
  const ids=(selector.match(/#[\w-]+/g)??[]).length;
  const classes=(selector.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+(?:\([^)]*\))?/g)??[]).length;
  const tags=(selector.replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|:[\w-]+(?:\([^)]*\))?/g," ").match(/(?:^|\s|>)\s*[a-zA-Z][\w-]*/g)??[]).length;
  return ids*100+classes*10+tags;
}
export { mediaMatches };
