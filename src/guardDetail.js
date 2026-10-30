import {GRAPHICS,getQuality} from './graphics.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
// Distant human silhouette: same standing scale, far fewer draw calls/triangles.
export function addGuardDetail(model){
 const legs=[];let gait=0,lastX=model.position.x,lastZ=model.position.z;const far=new THREE.Group();far.name='DistantGuard';const batches=new Map();
 function part(geometry,color,x,y,z){geometry.translate(x,y,z);if(!batches.has(color))batches.set(color,[]);batches.get(color).push(geometry);}
 part(new THREE.CapsuleGeometry(.20,.38,2,6),0x60654b,0,1.29,0);
 for(const side of [-1,1]){const arm=new THREE.CapsuleGeometry(.07,.35,2,5);arm.rotateX(.65);part(arm,0x60654b,side*.24,1.31,-.16);}
 part(new THREE.SphereGeometry(.12,8,6),0xb99776,0,1.72,0);part(new THREE.SphereGeometry(.145,8,4,0,Math.PI*2,0,Math.PI/2),0x353f30,0,1.77,0);
 part(new THREE.BoxGeometry(.27,.34,.13),0x353f30,0,1.3,.19);part(new THREE.BoxGeometry(.1,.12,.7),0x252c24,.1,1.25,-.50);
 for(const [color,geometries] of batches){const mesh=new THREE.Mesh(mergeGeometries(geometries.map(g=>g.index?g.toNonIndexed():g)),new THREE.MeshStandardMaterial({color,roughness:1}));far.add(mesh);geometries.forEach(g=>g.dispose());}
 for(const side of [-1,1]){
  const leg=new THREE.CapsuleGeometry(.075,.57,2,5);leg.translate(0,-.38,0);
  const boot=new THREE.BoxGeometry(.14,.13,.25);boot.translate(0,-.82,-.04);
  const pieces=[leg,boot].map(g=>g.index?g.toNonIndexed():g);
  const mesh=new THREE.Mesh(mergeGeometries(pieces),new THREE.MeshStandardMaterial({color:0x525b45,roughness:1}));
  mesh.position.set(side*.105,.91,0);far.add(mesh);legs.push(mesh);for(const g of new Set([leg,boot,...pieces]))g.dispose();
 }
 model.add(far);far.visible=false;
 return (distance,dead=false,deathAge=0)=>{
  const travelled=Math.hypot(model.position.x-lastX,model.position.z-lastZ);lastX=model.position.x;lastZ=model.position.z;
  if(travelled<2)gait+=travelled*7;
  legs.forEach((leg,i)=>{leg.rotation.x=!dead&&travelled>.001&&travelled<2?Math.sin(gait+i*Math.PI)*.42:0;});
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
