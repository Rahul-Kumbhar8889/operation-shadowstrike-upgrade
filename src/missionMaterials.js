import {getQuality} from './graphics.js';
import * as THREE from 'three';
// Existing self-hosted CC0 maps. Loading failure keeps the procedural fallback.
let pending;
export function loadMissionMaterials(){
 return pending??=Promise.all(['concrete','ground','metal','asphalt'].map(async name=>{
  const loader=new THREE.TextureLoader();
  const [map,normalMap,orm]=await Promise.all([`${name}-albedo.webp`,`${name}-normal.webp`,`${name}-orm.png`].map(file=>loader.loadAsync(`/assets/operations/${file}`)));
  for(const texture of [map,normalMap,orm]){texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;texture.repeat.setScalar(name==='ground'?80:name==='asphalt'?12:2);}
  map.colorSpace=THREE.SRGBColorSpace;normalMap.colorSpace=orm.colorSpace=THREE.NoColorSpace;
  return [name,{map,normalMap,roughnessMap:orm,aoMap:orm,metalnessMap:orm}];
 })).then(entries=>Object.fromEntries(entries)).catch(()=>null);
}
export function applyMissionMaterial(material,maps,kind){
 const textures=maps?.[kind];if(!textures)return false;
 Object.assign(material,textures);if(getQuality()==='low'){material.normalMap=null;material.aoMap=null;material.metalnessMap=null;}material.bumpMap=null;material.normalScale.setScalar(kind==='ground'?.35:.5);material.roughness=1;material.metalness=kind==='metal'?.65:0;material.aoMapIntensity=.55;material.color.setHex(kind==='ground'?0x9b9d83:0xffffff);material.needsUpdate=true;return true;
}
