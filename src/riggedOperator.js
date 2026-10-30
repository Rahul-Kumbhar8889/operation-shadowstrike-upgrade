import * as THREE from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {createWeaponModel} from './weaponModels.js';
let template;
const lowerTrack=track=>/Hips|UpLeg|Leg\.|Foot|Toe/.test(track.name);
export function loadOperator(){return template??=import('three/addons/loaders/GLTFLoader.js').then(({GLTFLoader})=>new GLTFLoader().loadAsync('/assets/characters/operator.glb')).then(gltf=>{gltf.scene.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(gltf.scene);const height=bounds.max.y-bounds.min.y;if(!Number.isFinite(height)||height<1||height>3)throw new Error('Invalid operator source size');gltf.normalization={scale:1.91/height,floor:bounds.min.y};gltf.scene.traverse(o=>{if(o.geometry)o.geometry.userData.sharedOperator=true;});return gltf;}).catch(()=>null);}
export async function attachRiggedOperator(root,fabric){
 const gltf=await loadOperator();if(!gltf||!root.parent)return false;
 const visual=clone(gltf.scene);visual.name='RiggedOperator';
 const hand=visual.getObjectByName('mixamorigRightHand');if(!hand)return false;
 const {scale,floor}=gltf.normalization;
 visual.scale.setScalar(scale);visual.position.y=-floor*scale;visual.rotation.y=Math.PI;
 const fallback=[...root.children];root.add(visual);
 const hidden=new Set(fallback.filter(child=>child!==root.userData.aimRig));root.userData.hiddenParts=hidden;
 for(const child of hidden)child.visible=false;
 for(const child of root.userData.aimRig.children)if(child!==root.userData.rifle)child.visible=false;
 visual.traverse(o=>{if(!o.isMesh)return;o.castShadow=o.receiveShadow=true;o.frustumCulled=false;
  const prepare=source=>{const material=source.clone();material.side=THREE.FrontSide;if(/Clothes/.test(material.name)){material.map=fabric;material.bumpMap=fabric;material.bumpScale=.006;material.color.setHex(0xaab49a);material.roughness=.92;}if(/Iron|Metal/.test(material.name)){material.metalness=.2;material.roughness=.65;}if(/Glass/.test(material.name)){material.metalness=.1;material.roughness=.25;}if(/Armor/.test(material.name)){material.roughness=.82;material.metalness=.03;}if(/Boots|Shoes/.test(material.name)){material.roughness=.94;material.metalness=0;}return material;};
  o.material=Array.isArray(o.material)?o.material.map(prepare):prepare(o.material);
 });
 const rifle=root.userData.rifle;
 if(!root.userData.weaponModels){for(const child of rifle.children)if(child.isMesh)child.visible=false;rifle.add(createWeaponModel('assault'));}
 const mixer=new THREE.AnimationMixer(visual),actions=new Map();
 for(const clip of gltf.animations){
  if(clip.name.startsWith('aim_'))for(const [part,filter] of [['lower',lowerTrack],['upper',t=>!lowerTrack(t)]]){
   const action=mixer.clipAction(new THREE.AnimationClip(`${clip.name}_${part}`,clip.duration,clip.tracks.filter(filter)));actions.set(`${clip.name}_${part}`,action);
  }else {const tracks=['reload','shoot'].includes(clip.name)?clip.tracks.filter(t=>!lowerTrack(t)):clip.tracks;const action=mixer.clipAction(new THREE.AnimationClip(clip.name,clip.duration,tracks));action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;actions.set(clip.name,action);}
 }
 let lower,upper,fire=0,dead=false,reloadSeconds=root.userData.reloadSeconds||1.5,lastReload=false;
 const select=(previous,name)=>{const next=actions.get(name);if(!next||next===previous)return previous;next.reset().setEffectiveWeight(1).play();if(previous)previous.crossFadeTo(next,.12,false);return next;};
 const p=new THREE.Vector3(),q=new THREE.Quaternion(),parentQ=new THREE.Quaternion(),offset=new THREE.Vector3();
 const anchor=()=>{
  root.updateWorldMatrix(true,false);root.updateMatrixWorld(true);hand.getWorldPosition(p);
  root.getWorldQuaternion(q);q.multiply(root.userData.aimRig.quaternion);
  offset.set(0,-.21,-.10).multiplyScalar(.62).applyQuaternion(q);p.sub(offset);
  rifle.parent.worldToLocal(p);rifle.position.copy(p);rifle.parent.getWorldQuaternion(parentQ);rifle.quaternion.copy(parentQ.invert().multiply(q));
 };
 const setReloading=(active,seconds)=>{reloadSeconds=seconds||reloadSeconds;if(active&&!lastReload){const action=actions.get('reload');action?.reset().setEffectiveTimeScale(action.getClip().duration/reloadSeconds);}lastReload=active;};
 const update=(dt,moving=false,sprint=false,reloading=false)=>{
  if(dead){for(const action of actions.values())action.stop();dead=false;lower=upper=null;root.rotation.x=root.rotation.z=0;root.position.y=0;}
  if(root.userData.detailed===false)return;
  const base=moving?(sprint?'aim_sprint':'aim_walk'):'aim_idle';
  lower=select(lower,`${base}_lower`);setReloading(reloading,reloadSeconds);
  fire=Math.max(0,fire-dt);const name=reloading?'reload':fire>0?'shoot':`${base}_upper`;
  upper=select(upper,name);mixer.update(Math.min(dt,.1));anchor();
 };
 const death=elapsed=>{
  if(!dead){for(const action of actions.values())action.stop();dead=true;actions.get('death').reset().setEffectiveWeight(1).play();}
  root.rotation.x=root.rotation.z=0;root.position.y=0;
  const duration=actions.get('death').getClip().duration;mixer.setTime(Math.min(elapsed,duration-.001));anchor();return elapsed>=duration;
 };
 const oldAim=root.userData.setAimDirection;
 Object.assign(root.userData,{rigged:{visual,mixer,death},modelVersion:'rigged-operator-v1',modelState:'ready',animationNames:[...actions.keys()],setReloading,updateAnimation:update,
  setAimDirection(direction){oldAim?.(direction);},
  playRecoil(){const action=actions.get('shoot');fire=Math.max(.15,action?.getClip().duration||.2);action?.reset();}
 });
 update(.001);return true;
}
