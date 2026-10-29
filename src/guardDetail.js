import {GRAPHICS,getQuality} from './graphics.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
// Distant human silhouette: same standing scale, far fewer draw calls/triangles.
export function addGuardDetail(model){
 const far=new THREE.Group();far.name='DistantGuard';const batches=new Map();
 function part(geometry,color,x,y,z){geometry.translate(x,y,z);if(!batches.has(color))batches.set(color,[]);batches.get(color).push(geometry);}
 part(new THREE.CapsuleGeometry(.20,.38,2,6),0x60654b,0,1.29,0);
 for(const side of [-1,1]){part(new THREE.CapsuleGeometry(.075,.57,2,5),0x60654b,side*.105,.53,0);const arm=new THREE.CapsuleGeometry(.07,.35,2,5);arm.rotateX(.65);part(arm,0x60654b,side*.24,1.31,-.16);part(new THREE.BoxGeometry(.14,.13,.25),0x252c24,side*.105,.09,-.04);}
 part(new THREE.SphereGeometry(.12,8,6),0xb99776,0,1.72,0);part(new THREE.SphereGeometry(.145,8,4,0,Math.PI*2,0,Math.PI/2),0x353f30,0,1.77,0);
 part(new THREE.BoxGeometry(.27,.34,.13),0x353f30,0,1.3,.19);part(new THREE.BoxGeometry(.1,.12,.7),0x252c24,.1,1.25,-.50);
 for(const [color,geometries] of batches){const mesh=new THREE.Mesh(mergeGeometries(geometries.map(g=>g.index?g.toNonIndexed():g)),new THREE.MeshStandardMaterial({color,roughness:1}));far.add(mesh);geometries.forEach(g=>g.dispose());}
 model.add(far);far.visible=false;
 return (distance,dead=false,deathAge=0)=>{
  const detailed=distance<GRAPHICS[getQuality()].guardDetail;model.userData.detailed=detailed;
  for(const child of model.children)if(child!==far)child.visible=detailed&&!model.userData.hiddenParts?.has(child);
  far.visible=!detailed;
  // Rigged death animates bones, not the root, so its distant replacement needs
  // a separate fall pose. The procedural fallback already rotates its root.
  const t=dead&&model.userData.rigged?THREE.MathUtils.clamp(deathAge/1.05,0,1):0;
  const fall=t*t*(3-2*t);
  far.rotation.x=fall?-Math.PI/2*fall:0;far.position.y=.28*fall;
 };
}
