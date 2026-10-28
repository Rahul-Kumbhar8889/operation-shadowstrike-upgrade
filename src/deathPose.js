import * as THREE from 'three';
export function applyDeathPose(model,elapsed){
 const t=THREE.MathUtils.clamp(elapsed/1.05,0,1),fall=t*t*(3-2*t);
 model.rotation.x=-Math.PI/2*fall;model.rotation.z=.12*Math.sin(Math.PI*t);model.position.y=.28*fall;
 const torso=model.getObjectByName('Torso');if(torso)torso.rotation.x=.25*Math.sin(Math.PI*t);
 model.traverse(o=>{if(o.name==='Knee')o.rotation.x=.65*fall;if(o.name==='Elbow')o.rotation.x=.45*fall;});
 const aim=model.userData.aimRig;if(aim)aim.rotation.x=-.25*fall;
 return t===1;
}
