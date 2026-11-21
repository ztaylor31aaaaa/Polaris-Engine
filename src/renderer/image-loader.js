import { ResourceLoader } from "./resource-loader.js";
export class ImageResourceLoader {
  constructor(options={}){this.resources=options.resourceLoader??new ResourceLoader(options);this.decode=options.decode??globalThis.createImageBitmap?.bind(globalThis);this.cache=new Map();}
  async load(reference,options={}){
    const url=this.resources.resolve(reference,options.baseURL);
    if(this.cache.has(url))return this.cache.get(url);
    const promise=this._load(url,options);this.cache.set(url,promise);
    try{return await promise;}catch(error){this.cache.delete(url);throw error;}
  }
  async _load(url,options){
    if(typeof this.decode!=="function")throw new Error("Image decoding is unavailable in this host");
    try{
      const {bytes,contentType}=await this.resources.fetchBytes(url,{signal:options.signal,credentials:options.credentials});
      if(!/^image\/(png|jpeg|gif|webp|avif|bmp|svg\+xml)/i.test(contentType))throw new Error("Unsupported image MIME type: "+contentType);
      const blob=new Blob([bytes],{type:contentType});
      const bitmap=await this.decode(blob);
      return {url,bitmap,width:bitmap.width,height:bitmap.height,contentType,originClean:true};
    }catch(fetchError){
      // Native image loading can display cross-origin pixels; canvas readback remains protected.
      if(typeof globalThis.Image!=="function")throw fetchError;
      const image=new Image();image.decoding="async";image.src=url;
      try{if(typeof image.decode==="function")await image.decode();else await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error("Image request failed"));});}
      catch{throw fetchError;}
      return {url,bitmap:image,width:image.naturalWidth||image.width,height:image.naturalHeight||image.height,contentType:"image/native",originClean:false};
    }
  }
  clear(){for(const item of this.cache.values())item.then(result=>result.bitmap?.close?.()).catch(()=>{});this.cache.clear();}
}
