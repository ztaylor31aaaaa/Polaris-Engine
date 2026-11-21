export class PolarisHistory {
  constructor(options={}){this.entries=[];this.index=-1;this.maxEntries=options.maxEntries??500;this.onChange=options.onChange??(()=>{});this.state=null;}
  get length(){return this.entries.length;}
  get current(){return this.entries[this.index]??null;}
  pushState(state,title,url){this._navigate(url,state,false);this.onChange(this.current);}
  replaceState(state,title,url){this._navigate(url,state,true);this.onChange(this.current);}
  _navigate(url,state,replace){
    const current=this.current,base=current?.url??"about:blank";
    const resolved=url==null?base:new URL(String(url),base).href;
    if(replace&&this.index>=0)this.entries[this.index]={url:resolved,state,title:""};
    else{this.entries.splice(this.index+1);this.entries.push({url:resolved,state,title:""});if(this.entries.length>this.maxEntries)this.entries.shift();this.index=this.entries.length-1;}
    this.state=state??null;
  }
  go(delta=0){const next=Math.max(0,Math.min(this.entries.length-1,this.index+Number(delta)));if(next===this.index)return this.current;this.index=next;this.state=this.current?.state??null;this.onChange(this.current);return this.current;}
  back(){return this.go(-1);}
  forward(){return this.go(1);}
  snapshot(){return {entries:this.entries.map(item=>({...item})),index:this.index};}
  restore(snapshot){if(!snapshot||!Array.isArray(snapshot.entries))throw new TypeError("Invalid history snapshot");this.entries=snapshot.entries.slice(-this.maxEntries).map(item=>({...item}));this.index=Math.max(-1,Math.min(this.entries.length-1,snapshot.index));this.state=this.current?.state??null;return this.current;}
}
