export const RENDERER_CAPABILITIES=Object.freeze({
  documentModel:true,htmlParsing:true,cssCascade:true,blockLayout:true,inlineLayout:true,flexLayout:"basic",
  canvasPainting:true,domEvents:"basic-bubbling",mutationObserver:"runtime-mediated",forms:"url-encoded-get-post",
  imageLoading:"host-decoded",history:true,accessibilityTree:true,webWorkers:false,webAssembly:false,
  javascriptExecution:false,cssGrid:false,svgRendering:false,webgl:false,serviceWorkers:false
});
export function getRendererCapabilities(){return {...RENDERER_CAPABILITIES};}
export function supportsRendererFeature(feature){return Boolean(RENDERER_CAPABILITIES[feature]);}
