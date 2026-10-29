export const GRAPHICS={low:{pixelRatio:1,shadowSize:512,shadows:false,guardDetail:20},balanced:{pixelRatio:1.25,shadowSize:1024,shadows:true,guardDetail:32},high:{pixelRatio:1.75,shadowSize:2048,shadows:true,guardDetail:50}};
const key='shadowstrike.graphics.v1';let quality='balanced';
try{const saved=globalThis.localStorage?.getItem(key);if(GRAPHICS[saved])quality=saved;}catch{}
export function getQuality(){return quality;}
export function setQuality(value){if(!GRAPHICS[value])throw new RangeError('Unknown graphics quality');quality=value;try{globalThis.localStorage?.setItem(key,value);}catch{}return GRAPHICS[value];}
export function applyRendererQuality(renderer,sun){const options=GRAPHICS[quality];renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,options.pixelRatio));renderer.shadowMap.enabled=options.shadows;if(sun){sun.shadow.map?.dispose();sun.shadow.map=null;sun.shadow.mapSize.set(options.shadowSize,options.shadowSize);}renderer.shadowMap.needsUpdate=true;return options;}
